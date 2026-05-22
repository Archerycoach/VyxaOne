import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openAIApiKey = process.env.OPENAI_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  
  if (!openAIApiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing in environment" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { message, history } = req.body;

    // Fetch context to give the AI real CRM data
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, status, lead_type, budget_max, next_follow_up")
      .eq("assigned_to", user.id)
      .in("status", ["new", "contacted", "qualified"])
      .limit(15);
      
    const { data: events } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, event_type")
      .eq("user_id", user.id)
      .gte("start_time", new Date().toISOString())
      .limit(5);

    const contextStr = JSON.stringify({
      agent_name: profile?.full_name || "Agente",
      current_time: new Date().toISOString(),
      active_leads: leads || [],
      upcoming_events: events || []
    });

    const systemMessage = {
      role: "system",
      content: `És um assistente imobiliário virtual integrado no CRM Vyxa. Estás a falar com o agente imobiliário ${profile?.full_name || "Utilizador"}.
Usa os seguintes dados contextuais (Leads Ativas e Próximos Eventos) para responder se o utilizador perguntar sobre o seu trabalho:
${contextStr}

Sê profissional, conciso, e muito útil. Usa formatação em Markdown sempre que fizer sentido (listas, negritos).`
    };

    const messages = [systemMessage, ...(history || []), { role: "user", content: message }];

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7
      })
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("OpenAI erro:", errorText);
      throw new Error("Failed to communicate with OpenAI");
    }

    const gptData = await openAiRes.json();
    const reply = gptData.choices[0].message.content;

    res.status(200).json({ reply });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
}