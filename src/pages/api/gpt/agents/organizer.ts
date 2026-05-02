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

    // 1. Recolher contexto: Tarefas
    const { data: tasks } = await (supabaseAdmin
      .from("tasks" as any)
      .select("title, status, due_date, priority")
      .eq("user_id", user.id)
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true })
      .limit(10) as any);

    // 2. Recolher contexto: Leads sem contacto recente
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: neglectedLeads } = await (supabaseAdmin
      .from("leads" as any)
      .select("name, status, temperature")
      .eq("user_id", user.id)
      .in("status", ["new", "contacted", "qualified"])
      .lt("last_activity_date", thirtyDaysAgo.toISOString())
      .limit(5) as any);

    // 3. Recolher contexto: Eventos de Hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: events } = await (supabaseAdmin
      .from("calendar_events" as any)
      .select("title, start_time, event_type")
      .eq("user_id", user.id)
      .gte("start_time", today.toISOString())
      .lt("start_time", tomorrow.toISOString()) as any);

    // 4. Buscar Chave API
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

    // 5. Construir Prompt
    const systemPrompt = `És um Assistente Organizador Pessoal de um consultor imobiliário.
Analisa os dados fornecidos e cria um plano de ação curto, direto e altamente acionável.
Regras:
1. Começa com uma saudação encorajadora.
2. Destaca o evento ou tarefa mais crítica do dia.
3. Se houver leads esquecidos, aconselha um toque rápido (follow-up).
4. Usa formatação limpa (listas) e uma linguagem muito objetiva, sem conversa de "robô".
5. Não inventes dados que não estejam abaixo.`;

    const userPrompt = `Aqui estão os meus dados atuais:
Tarefas pendentes: ${JSON.stringify(tasks || [])}
Leads a arrefecer (sem atividade >30 dias): ${JSON.stringify(neglectedLeads || [])}
Eventos para hoje: ${JSON.stringify(events || [])}

Diz-me exatamente o que devo fazer primeiro e como estruturar o meu dia.`;

    // 6. Chamar OpenAI
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
    console.error("Organizer Agent Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}