import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const propertyId = req.query.id as string;

    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    // Procurar interações (visitas) associadas a este imóvel
    const { data: interactions } = await supabaseAdmin
      .from("interactions")
      .select("interaction_type, outcome, content, interaction_date")
      .eq("property_id", propertyId)
      .order("interaction_date", { ascending: false });

    // Procurar notas soltas que mencionem o imóvel
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("title, description, completed_at, status")
      .eq("related_property_id", propertyId);

    // Buscar chave da base de dados (dinâmica) com fallback para variável de ambiente
    const { data: keyData } = await (supabaseAdmin
      .from("gpt_api_keys" as any)
      .select("api_key")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle() as any);

    const openAIApiKey = keyData?.api_key || process.env.OPENAI_API_KEY;

    if (!openAIApiKey) {
      return res.status(400).json({ error: "OpenAI API Key não configurada. Configure no menu Definições > Agente GPT." });
    }

    const prompt = `És um consultor imobiliário a escrever um relatório de feedback (Sellers Report) para o proprietário do imóvel angariado.
    
    Imóvel: ${property?.title || 'Imóvel'} (${property?.reference_code || 'Sem ref'})
    Preço atual: ${property?.price}€
    
    Visitas e Interações com clientes sobre este imóvel:
    ${JSON.stringify(interactions || [], null, 2)}
    
    Tarefas realizadas sobre o imóvel:
    ${JSON.stringify(tasks || [], null, 2)}
    
    O teu objetivo:
    Cria um relatório em HTML limpo e profissional (usa h3, p, ul, li) para enviar ao proprietário.
    - Faz um resumo do esforço comercial.
    - Sintetiza o feedback dos clientes (o que gostaram e o que não gostaram).
    - Se houver muito feedback sobre o preço alto, sugere subtilmente uma avaliação do valor.
    - Mostra profissionalismo e transparência.
    
    Responde EXCLUSIVAMENTE com o código HTML final do relatório.`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("OpenAI erro no seller report:", errorText);
      let openAiErrorMessage = "Erro ao gerar relatório na OpenAI";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          openAiErrorMessage = `Erro OpenAI: ${errorJson.error.message}`;
        }
      } catch (e) {
        openAiErrorMessage = `Erro OpenAI: ${errorText}`;
      }
      throw new Error(openAiErrorMessage);
    }

    const gptData = await openAiRes.json();
    const generatedHtml = gptData.choices[0].message.content.trim();

    return res.status(200).json({ success: true, report_html: generatedHtml });
  } catch (error: any) {
    console.error("Seller Report Error:", error);
    return res.status(500).json({ error: error.message });
  }
}