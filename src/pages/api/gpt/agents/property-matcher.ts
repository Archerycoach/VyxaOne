import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/provider";
import { findMatchesForLead } from "@/services/matchingService";
import { sendClientEmail } from "@/lib/server/sendClientEmail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { leadId, userId } = req.body;
    if (!leadId || !userId) return res.status(400).json({ error: "Missing parameters" });

    // 1. Get lead info
    const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (!lead || !lead.email) return res.status(200).json({ message: "No email or lead not found" });

    // 2. Check if user has property matcher enabled
    const { data: gptSettings } = await supabase
      .from("gpt_api_keys")
      .select("property_matcher_enabled")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!gptSettings?.property_matcher_enabled) {
      console.log("Property Matcher is disabled in settings. Skipping auto-reply.");
      return res.status(200).json({ message: "Property matcher disabled" });
    }

    // 3. Check SMTP
    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!smtpSettings) return res.status(200).json({ message: "No SMTP settings" });

    // 4. Find real property matches (internal DB + Idealista)
    console.log(`[Property Matcher] Finding matches for lead ${leadId}...`);
    const matches = await findMatchesForLead(leadId);
    
    if (matches.length === 0) {
      console.log(`[Property Matcher] No matches found for lead ${leadId}`);
      return res.status(200).json({ message: "No matching properties found" });
    }

    // Take top 5 matches
    const topMatches = matches.slice(0, 5);
    console.log(`[Property Matcher] Found ${topMatches.length} top matches`);

    // 5. Generate personalized pitch for each property
    const enrichedProperties = await Promise.all(
      topMatches.map(async (match) => {
        const pitchPrompt = `Escreve 2-3 frases de argumentário personalizado para apresentar este imóvel a "${lead.name}".

Perfil da lead:
- Tipo: ${lead.lead_type === 'buyer' ? 'Comprador' : lead.lead_type === 'renter' ? 'Arrendatário' : 'Investidor'}
- Orçamento: ${lead.budget_min ? lead.budget_min + '€' : 'N/A'} - ${lead.budget_max ? lead.budget_max + '€' : 'N/A'}
- Preferências: ${lead.location_preference || 'N/A'}, ${lead.bedrooms ? lead.bedrooms + ' quartos' : ''}, ${lead.min_area ? lead.min_area + 'm²' : ''}

Imóvel:
- Título: ${match.property.title}
- Preço: ${match.property.price}€
- Localização: ${match.property.location || match.property.city}
- Quartos: ${match.property.bedrooms || match.property.rooms || 'N/A'}
- Área: ${match.property.area || match.property.size || 'N/A'}m²
- Match Score: ${match.match_score}%
- Razões: ${match.match_reasons.join(', ')}

${lead.lead_type === 'investor' ? 'Foca em rentabilidade, potencial de valorização e ROI.' : ''}
${lead.lead_type === 'buyer' ? 'Foca em conforto, qualidade de vida, zona familiar.' : ''}
${lead.lead_type === 'renter' ? 'Foca em acessibilidade, comodidades e flexibilidade.' : ''}

Responde APENAS com o texto do argumentário (2-3 frases), sem introdução ou conclusão.`;

        try {
          const pitchResponse = await runAI({
            userId,
            task: "property_pitch",
            messages: [{ role: "user", content: pitchPrompt }],
            temperature: 0.8,
          });

          return {
            ...match.property,
            match_score: match.match_score,
            match_reasons: match.match_reasons,
            source: match.source,
            pitch: pitchResponse.text.trim(),
          };
        } catch (error) {
          console.error("Error generating pitch:", error);
          return {
            ...match.property,
            match_score: match.match_score,
            match_reasons: match.match_reasons,
            source: match.source,
            pitch: "Imóvel que corresponde ao seu perfil de pesquisa.",
          };
        }
      })
    );

    // 6. Generate email with AI
    const propertiesContext = enrichedProperties.map((p, i) => 
      `Imóvel ${i+1} (${p.match_score}% match, fonte: ${p.source === 'idealista' ? 'Idealista' : 'Base de dados interna'}):
- Título: ${p.title}
- Preço: ${p.price}€
- Localização: ${p.location || p.city}
- Características: ${p.bedrooms || p.rooms || 'N/A'} quartos, ${p.area || p.size || 'N/A'}m²
- Razões do match: ${p.match_reasons.join(', ')}
- Argumentário: ${p.pitch}
- Imagem: ${p.thumbnail || 'N/A'}
${p.url ? `- URL: ${p.url}` : ''}`
    ).join('\n\n');

    const emailPrompt = `Escreve um email persuasivo, profissional e empático em português de Portugal para o cliente "${lead.name}".

O cliente procura:
- Tipo: ${lead.lead_type === 'buyer' ? 'Comprar' : lead.lead_type === 'renter' ? 'Arrendar' : 'Investir'}
- Tipologia: ${lead.typology || lead.bedrooms ? lead.bedrooms + ' quartos' : 'Não especificado'}
- Orçamento: ${lead.budget_max ? lead.budget_max + '€' : 'Não especificado'}
- Zona: ${lead.location_preference || 'Não especificado'}

Encontrámos ${enrichedProperties.length} imóveis que correspondem ao perfil (com scores de 40% a 100%):

${propertiesContext}

O email DEVE:
1. Ser escrito em HTML válido (podes usar <b>, <p>, <ul>, <li>, <br>, <div> e cores suaves)
2. NÃO incluir as tags <html>, <head> ou <body>, apenas o conteúdo interior
3. Para cada imóvel, criar uma estrutura visual atraente com:
   - Imagem (se disponível) com: <img src="URL" style="width:100%; max-width:400px; border-radius:8px; margin:10px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>
   - Título, preço, localização, características
   - O argumentário personalizado gerado pela IA
   - Score de match e razões principais
4. Destacar os pontos fortes de cada imóvel baseado no argumentário
5. Call-to-action clara (agendar visita ou chamada)
6. Tom profissional mas caloroso

Responde EXCLUSIVAMENTE com o HTML da mensagem.`;

    const aiResponse = await runAI({
      userId,
      task: "property_matcher_email",
      messages: [{ role: "user", content: emailPrompt }],
      temperature: 0.7,
    });

    let emailHtml = aiResponse.text.trim();
    // Clean up potential markdown formatting
    emailHtml = emailHtml.replace(/```html/g, "").replace(/```/g, "").trim();

    // 7. Send the email via the centralized client-email service (SMTP +
    // cópia best-effort no IMAP + registo em automated_email_log).
    const sendResult = await sendClientEmail({
      supabaseAdmin: supabase,
      userId,
      leadId,
      leadName: lead.name,
      source: "property_matcher",
      to: lead.email,
      subject: `${enrichedProperties.length} imóveis ideais para si, ${lead.name}`,
      html: emailHtml,
    });

    if (!sendResult.success) {
      console.error(`[Property Matcher] Falha ao enviar email:`, sendResult.error);
      return res.status(200).json({ success: false, message: sendResult.error });
    }

    // 8. Log interaction in the CRM
    await supabase.from("interactions").insert({
      lead_id: leadId,
      user_id: userId,
      type: "email",
      notes: `Email Automático IA: Enviados ${enrichedProperties.length} imóveis com match real (scores: ${enrichedProperties.map(p => p.match_score + '%').join(', ')}). Fontes: ${enrichedProperties.filter(p => p.source === 'internal').length} BD interna + ${enrichedProperties.filter(p => p.source === 'idealista').length} Idealista.`,
    });

    console.log(`[Property Matcher] Email sent successfully to ${lead.email}`);

    return res.status(200).json({ 
      success: true, 
      propertiesCount: enrichedProperties.length,
      topScore: enrichedProperties[0]?.match_score,
    });

  } catch (error: any) {
    console.error("Property Matcher error:", error);
    return res.status(500).json({ error: error.message });
  }
}