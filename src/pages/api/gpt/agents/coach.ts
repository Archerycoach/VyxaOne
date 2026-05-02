import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

    // 1. Dados de Funil (Contagem de status)
    const { data: leads } = await (supabaseAdmin
      .from("leads" as any)
      .select("status, estimated_value")
      .eq("user_id", user.id)
      .is("archived_at", null) as any);

    const funnelCounts = (leads || []).reduce((acc: any, lead: any) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});
    const totalLeads = leads?.length || 0;

    // 2. Negócios Fechados (Este ano)
    const currentYear = new Date().getFullYear();
    const { data: deals } = await (supabaseAdmin
      .from("deals" as any)
      .select("amount")
      .eq("user_id", user.id)
      .gte("transaction_date", `${currentYear}-01-01`) as any);

    const wonDealsCount = deals?.length || 0;
    const conversionRate = totalLeads > 0 ? ((wonDealsCount / totalLeads) * 100).toFixed(1) : 0;

    // 3. Buscar Chave API
    let openAIApiKey = process.env.OPENAI_API_KEY;
    try {
      const { data: keyData } = await (supabaseAdmin
        .from("gpt_api_keys" as any)
        .select("api_key")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle() as any);
      if (keyData?.api_key) openAIApiKey = keyData.api_key;
    } catch (e) {
      console.warn("Falha na tabela de chaves, a usar env");
    }

    if (!openAIApiKey) {
      return res.status(400).json({ error: "OpenAI API Key não configurada." });
    }

    // 4. Construir Prompt Preditivo
    const systemPrompt = `És um 'Coach de Performance' implacável e experiente em imobiliário.
Analisa os dados do consultor.
Regras:
1. Faz uma avaliação rápida da taxa de conversão (Leads totais vs Negócios fechados).
2. Se a taxa for baixa (<3%), alerta para o facto de não estar a qualificar bem os leads. Se for >10%, elogia o fecho.
3. Dá 2 ou 3 conselhos muito matemáticos e preditivos. Exemplo: "Com base no teu funil (onde tens muitos em 'proposta'), deves focar-te em fazer 5 chamadas de fecho hoje."
4. Mantém a resposta concisa, agressivamente focada em resultados e produtividade. Não divagues.
5. Formata com parágrafos claros.`;

    const userPrompt = `O meu funil atual: ${JSON.stringify(funnelCounts)}
Leads Totais no sistema: ${totalLeads}
Negócios ganhos este ano: ${wonDealsCount}
Taxa de conversão atual calculada: ${conversionRate}%

Diz-me a verdade sobre o meu funil e onde preciso de focar esforços esta semana.`;

    // 5. Chamar OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Error:", errText);
      return res.status(500).json({ error: "Falha na comunicação com a IA." });
    }

    const aiData = await response.json();
    return res.status(200).json({ advice: aiData.choices[0].message.content });

  } catch (error: any) {
    console.error("Coach Agent Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}