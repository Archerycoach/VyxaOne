import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getDailyOrganizerPrompt } from "@/lib/ai/prompts/dailyOrganizer";

interface NeglectedLeadRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
  temperature: string | null;
  property_type: string | null;
  location_preference: string | null;
  budget_min: number | null;
  budget_max: number | null;
  min_area: number | null;
  max_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  source: string | null;
  last_activity_date: string | null;
  last_contact_date: string | null;
  next_follow_up: string | null;
}

interface OrganizerLeadNoteRecord {
  lead_id: string;
  note: string;
  created_at: string | null;
}

interface OrganizerLeadInteractionRecord {
  lead_id: string | null;
  interaction_type: string;
  subject: string | null;
  content: string | null;
  outcome: string | null;
  interaction_date: string | null;
  created_at: string | null;
}

interface NeglectedLeadContextRecord extends NeglectedLeadRecord {
  notes_history: OrganizerLeadNoteRecord[];
  interactions_history: OrganizerLeadInteractionRecord[];
  historical_summary: {
    notes_count: number;
    interactions_count: number;
    last_note_at: string | null;
    last_interaction_at: string | null;
  };
}

function buildNeglectedLeadContexts(
  leads: NeglectedLeadRecord[],
  notes: OrganizerLeadNoteRecord[],
  interactions: OrganizerLeadInteractionRecord[],
): NeglectedLeadContextRecord[] {
  const notesByLead = notes.reduce<Record<string, OrganizerLeadNoteRecord[]>>((acc, note) => {
    if (!acc[note.lead_id]) {
      acc[note.lead_id] = [];
    }

    acc[note.lead_id].push(note);
    return acc;
  }, {});

  const interactionsByLead = interactions.reduce<Record<string, OrganizerLeadInteractionRecord[]>>((acc, interaction) => {
    if (!interaction.lead_id) {
      return acc;
    }

    if (!acc[interaction.lead_id]) {
      acc[interaction.lead_id] = [];
    }

    acc[interaction.lead_id].push(interaction);
    return acc;
  }, {});

  return leads.map((lead) => {
    const leadNotes = notesByLead[lead.id] || [];
    const leadInteractions = interactionsByLead[lead.id] || [];

    return {
      ...lead,
      notes_history: leadNotes,
      interactions_history: leadInteractions,
      historical_summary: {
        notes_count: leadNotes.length,
        interactions_count: leadInteractions.length,
        last_note_at: leadNotes[0]?.created_at || null,
        last_interaction_at: leadInteractions[0]?.interaction_date || leadInteractions[0]?.created_at || null,
      },
    };
  });
}

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
      .select("id, name, phone, email, status, temperature, property_type, location_preference, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source, last_activity_date, last_contact_date, next_follow_up")
      .eq("user_id", user.id)
      .in("status", ["new", "contacted", "qualified"])
      .lt("last_activity_date", thirtyDaysAgo.toISOString())
      .limit(5) as any);
      
    if (neglectedError) console.error("Erro neglected leads:", neglectedError);

    const neglectedLeadIds = ((neglectedLeads || []) as NeglectedLeadRecord[]).map((lead) => lead.id);
    let neglectedLeadNotes: OrganizerLeadNoteRecord[] = [];
    let neglectedLeadInteractions: OrganizerLeadInteractionRecord[] = [];

    if (neglectedLeadIds.length > 0) {
      const { data: notes, error: notesError } = await (supabaseAdmin
        .from("lead_notes" as any)
        .select("lead_id, note, created_at")
        .in("lead_id", neglectedLeadIds)
        .order("created_at", { ascending: false }) as any);

      if (notesError) console.error("Erro lead notes:", notesError);
      neglectedLeadNotes = (notes || []) as OrganizerLeadNoteRecord[];

      const { data: interactions, error: interactionsError } = await (supabaseAdmin
        .from("interactions" as any)
        .select("lead_id, interaction_type, subject, content, outcome, interaction_date, created_at")
        .in("lead_id", neglectedLeadIds)
        .order("interaction_date", { ascending: false }) as any);

      if (interactionsError) console.error("Erro lead interactions:", interactionsError);
      neglectedLeadInteractions = (interactions || []) as OrganizerLeadInteractionRecord[];
    }

    const enrichedNeglectedLeads = buildNeglectedLeadContexts(
      (neglectedLeads || []) as NeglectedLeadRecord[],
      neglectedLeadNotes,
      neglectedLeadInteractions,
    );

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

    // 4. Construir Prompt
    const prompts = getDailyOrganizerPrompt({
      tasks: tasks || [],
      enrichedNeglectedLeads,
      events: events || []
    });

    // 5. Chamar IA
    console.log("-> [ORGANIZER API] A chamar IA...");
    
    const aiResponse = await runAI({
      userId: user.id,
      task: "daily_organizer",
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      temperature: 0.7
    });

    console.log("-> [ORGANIZER API] Resposta IA recebida com sucesso!");
    return res.status(200).json({ advice: aiResponse.text });

  } catch (error: any) {
    console.error("Organizer Agent Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}