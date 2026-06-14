import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("-> [ORGANIZER API] Iniciou o pedido POST");
  if (req.method !== "POST") return res.status(405).end();

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    console.log("-> [ORGANIZER API] A verificar token do utilizador...");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Não autorizado" });
    console.log("-> [ORGANIZER API] Utilizador autenticado:", user.id);

    // 1. Recolher contexto: Tarefas
    console.log("-> [ORGANIZER API] A recolher Tarefas...");
    const { data: tasks, error: tasksError } = await (supabaseAdmin
      .from("tasks" as any)
      .select("title, status, due_date, priority")
      .eq("user_id", user.id)
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true })
      .limit(10) as any);
      
    if (tasksError) console.error("Erro tasks:", tasksError);

    // 2. Recolher contexto: Leads sem contacto recente
    console.log("-> [ORGANIZER API] A recolher Leads Negligenciados...");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: neglectedLeads, error: neglectedError } = await (supabaseAdmin
      .from("leads" as any)
      .select("name, phone, email, status, temperature, property_type, location_preference, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source")
      .eq("user_id", user.id)
      .in("status", ["new", "contacted", "qualified"])
      .lt("last_activity_date", thirtyDaysAgo.toISOString())
      .limit(5) as any);
      
    if (neglectedError) console.error("Erro neglected leads:", neglectedError);

    // 3. Recolher contexto: Eventos de Hoje
    console.log("-> [ORGANIZER API] A recolher Eventos...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: events, error: eventsError } = await (supabaseAdmin
      .from("calendar_events" as any)
      .select("title, start_time, event_type")
      .eq("user_id", user.id)
      .gte("start_time", today.toISOString())
      .lt("start_time", tomorrow.toISOString()) as any);
      
    if (eventsError) console.error("Erro events:", eventsError);

    // 4. Buscar Chave OpenAI do servidor
    console.log("-> [ORGANIZER API] A verificar chave OpenAI do servidor...");
    const openAIApiKey = process.env.OPENAI_API_KEY;

    if (!openAIApiKey || openAIApiKey.trim() === "") {
      console.log("-> [ORGANIZER API] Erro Crítico: OPENAI_API_KEY não está configurada no servidor.");
      return res.status(400).json({
        error: "OpenAI API Key não está configurada no servidor. Atualize a variável OPENAI_API_KEY no ambiente do projeto."
      });
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
    console.log("-> [ORGANIZER API] A chamar OpenAI...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
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
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Error:", errText);
      return res.status(500).json({ error: "Falha na comunicação com a IA." });
    }

    console.log("-> [ORGANIZER API] Resposta OpenAI recebida com sucesso!");
    const aiData = await response.json();
    return res.status(200).json({ advice: aiData.choices[0].message.content });

  } catch (error: any) {
    console.error("Organizer Agent Error:", error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: "A OpenAI demorou demasiado tempo a responder. Tente novamente." });
    }
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}