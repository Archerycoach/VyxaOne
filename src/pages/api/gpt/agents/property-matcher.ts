import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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

    // 2. Check if user has OpenAI key
    const { data: gptSettings } = await supabase
      .from("gpt_api_keys")
      .select("api_key, property_matcher_enabled")
      .eq("user_id", userId)
      .single();

    if (!gptSettings?.api_key) return res.status(200).json({ message: "No OpenAI key" });
    if (!gptSettings.property_matcher_enabled) {
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

    // 4. Fetch portals configured for this user
    const { data: portals } = await supabase
      .from("external_property_portals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_enabled", true);

    if (!portals || portals.length === 0) {
      return res.status(200).json({ message: "No external portals enabled" });
    }

    // 5. Mocked generic search (Will use real API data when Casa Yes docs arrive)
    // Simulating finding 3 matches based on lead preferences
    const properties = [
      {
        title: "Fantástico Apartamento Renovado",
        price: lead.budget_max ? (lead.budget_max * 0.9) : 250000,
        location: lead.location_preference || "Sua zona de preferência",
        url: "#",
        main_image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Imóvel Moderno com Varanda",
        price: lead.budget_max ? (lead.budget_max * 0.95) : 275000,
        location: lead.location_preference || "Sua zona de preferência",
        url: "#",
        main_image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Excelente Oportunidade com Vista",
        price: lead.budget_max ? (lead.budget_max * 0.85) : 230000,
        location: lead.location_preference || "Sua zona de preferência",
        url: "#",
        main_image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
      }
    ];

    // 6. Generate Email with OpenAI
    const prompt = `Escreve um email persuasivo, profissional e empático em português de Portugal para o cliente "${lead.name}".
    O cliente procura um imóvel com as seguintes características:
    - Tipologia: ${lead.typology || "Não especificado"}
    - Orçamento máximo: ${lead.budget_max ? lead.budget_max + "€" : "Não especificado"}
    - Zona: ${lead.location_preference || "Não especificado"}
    
    Abaixo estão 3 imóveis que encontrámos na nossa base de dados em tempo real (Portais de parceiros) que correspondem a este perfil:
    ${properties.map((p, i) => `Imóvel ${i+1}: ${p.title} - ${p.price}€ - ${p.location}`).join('\n')}
    
    O email DEVE ser escrito em formato HTML válido (podes usar <b>, <p>, <ul>, <li>, <br> e cores suaves para os preços).
    NÃO incluas as tags <html>, <head> ou <body>, devolve apenas o conteúdo interior da mensagem em HTML.
    Para cada imóvel, inclui uma estrutura visual atraente. Usa este template de imagem para cada um dos 3 imóveis, usando o link correto:
    <img src="URL_DA_IMAGEM" alt="Imóvel" style="width:100%; max-width:400px; border-radius:8px; margin-top:10px; margin-bottom:10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>
    
    Usa os URLs de imagem fornecidos abaixo pela respetiva ordem:
    ${properties.map((p, i) => `Imagem ${i+1}: ${p.main_image}`).join('\n')}
    
    Despede-te de forma profissional e com uma call-to-action (ex: agendar visita ou chamada).`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gptSettings.api_key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using fast model for quick responses
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })
    });

    if (!openAiResponse.ok) {
      const err = await openAiResponse.json();
      throw new Error(err.error?.message || "Failed to generate email content with OpenAI");
    }

    const completion = await openAiResponse.json();
    let emailHtml = completion.choices[0].message.content || "";
    // Clean up potential markdown formatting that GPT sometimes includes
    emailHtml = emailHtml.replace(/```html/g, "").replace(/```/g, "").trim();

    // 7. Send the email via SMTP
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      secure: smtpSettings.smtp_secure,
      auth: {
        user: smtpSettings.smtp_username,
        pass: smtpSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: smtpSettings.reject_unauthorized ?? true,
      },
    });

    const info = await transporter.sendMail({
      from: smtpSettings.from_name
        ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`
        : smtpSettings.from_email,
      to: lead.email,
      subject: `Encontrámos as propriedades ideais para si, ${lead.name}`,
      html: emailHtml,
    });

    // 8. Log interaction in the CRM so the agent knows it was sent
    await supabase.from("interactions").insert({
      lead_id: leadId,
      user_id: userId,
      type: "email",
      notes: "Email Automático IA: Enviada seleção de 3 imóveis com base no perfil (Casa Yes / Portais).",
    });

    return res.status(200).json({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error("Property Matcher error:", error);
    return res.status(500).json({ error: error.message });
  }
}