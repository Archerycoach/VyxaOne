import { QUALIFICATION_FIELD_VALUE_HINTS, type QualificationFieldContext } from "@/lib/leadQualification";

export type { QualificationFieldContext };

/**
 * Prompt da análise automática de leads.
 *
 * Corre sempre que o consultor adiciona uma nota, interação ou nota de voz a
 * uma lead (ver src/lib/server/leadAutoAnalysis.ts). Substitui o antigo
 * prompt de análise de notas de voz (voiceNoteAnalysis.ts) no fluxo
 * automático: além do estado da lead e dos dados de qualificação, também
 * propõe tarefas, blocos de agenda (só com data/hora explícita) e próximas
 * ações a sugerir ao consultor.
 */

interface LeadAutoAnalysisContext {
  /** O registo que acabou de ser adicionado (nota, interação ou transcrição de voz). */
  newContent: string;
  /** Origem do novo registo, para dar contexto à IA. */
  trigger: "note" | "interaction" | "voice_note";
  leadData: {
    name: string;
    status: string;
    temperature: string;
    lead_type?: string | null;
    property_type?: string | null;
    location_preference?: string | null;
    budget?: number | null;
  };
  recentInteractions: Array<{ interaction_date: string; interaction_type: string; content?: string | null; outcome?: string | null }>;
  recentNotes: Array<{ created_at: string | null; note: string }>;
  /** Tarefas por concluir desta lead — para a IA não propor duplicados. */
  openTasks: Array<{ title: string | null; description?: string | null; due_date?: string | null }>;
  /** Campos de qualificação relevantes para esta lead, com o valor atual conhecido. */
  qualificationFields: QualificationFieldContext[];
  /**
   * Fases do pipeline configuradas para o tipo desta lead (comprador/vendedor).
   * São específicas de cada instalação — não podem ser fixas no prompt, senão
   * a IA sugere fases que não existem e a sugestão é sempre descartada.
   */
  pipelineStages: string[];
}

const TRIGGER_LABELS: Record<LeadAutoAnalysisContext["trigger"], string> = {
  note: "uma nota escrita",
  interaction: "o registo de uma interação (chamada, email, reunião, etc.)",
  voice_note: "a transcrição de uma nota de voz gravada após um contacto",
};

/**
 * Data/hora atual em Portugal Continental (Europe/Lisbon), em ISO 8601 com o
 * offset local (ex.: "2026-07-28T12:00:00+01:00").
 *
 * Dar a hora em UTC (toISOString) punha a IA — e a análise que ela escreve —
 * uma hora atrás no verão (WEST = UTC+1): daí referir "11h" quando o consultor
 * agendou "12h". Com a hora e o offset locais, o modelo raciocina e devolve
 * horários na mesma referência da agenda.
 */
function formatLisbonDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  // Offset atual de Lisboa (+01:00 no verão, +00:00 no inverno).
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const lisbon = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const offsetMinutes = Math.round((lisbon.getTime() - utc.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offH = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offM = String(absOffset % 60).padStart(2, "0");
  const hour = parts.hour === "24" ? "00" : parts.hour; // meia-noite pode vir como "24"

  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}${sign}${offH}:${offM}`;
}

export function getLeadAutoAnalysisPrompt(context: LeadAutoAnalysisContext): string {
  const { newContent, trigger, leadData, recentInteractions, recentNotes, openTasks, qualificationFields, pipelineStages } = context;

  const now = new Date();
  // Hora LOCAL de Portugal (Europe/Lisbon), não UTC — ver formatLisbonDateTime.
  const nowStr = formatLisbonDateTime(now);

  const interactionsContext = recentInteractions.length > 0
    ? recentInteractions.map((int, idx) =>
        `${idx + 1}. [${new Date(int.interaction_date).toLocaleDateString("pt-PT")}] ${int.interaction_type}: ${(int.content || int.outcome || "").substring(0, 150)}`
      ).join("\n")
    : "Sem interações anteriores registadas.";

  const notesContext = recentNotes.length > 0
    ? recentNotes.map((n, idx) =>
        `${idx + 1}. [${n.created_at ? new Date(n.created_at).toLocaleDateString("pt-PT") : "sem data"}] ${n.note.substring(0, 150)}`
      ).join("\n")
    : "Sem notas anteriores.";

  const openTasksContext = openTasks.length > 0
    ? openTasks
        .map((t, idx) => `${idx + 1}. ${t.title}${t.due_date ? ` (até ${t.due_date})` : ""}`)
        .join("\n")
    : "Nenhuma tarefa aberta.";

  const qualificationContext = qualificationFields.length > 0
    ? qualificationFields
        .map((f) => `- ${f.key}: "${f.label}" — valor atual no CRM: ${f.currentValue}. Formato esperado: ${QUALIFICATION_FIELD_VALUE_HINTS[f.key] || "texto livre"}.`)
        .join("\n")
    : "Nenhum campo de qualificação aplicável a esta lead.";

  return `És um assistente IA de um CRM imobiliário português. O consultor acabou de adicionar ${TRIGGER_LABELS[trigger]} a uma lead. Analisa a novidade no contexto do histórico e atualiza o CRM.

Data e hora atuais (hora de Portugal Continental, Europe/Lisbon): ${nowStr}
Todas as horas — as que referires na análise e as dos blocos de agenda — são nesta hora local. Usa SEMPRE o mesmo offset que aparece acima (ex.: +01:00) e nunca convertas para UTC.

**LEAD:**
- Nome: ${leadData.name}
- Status Atual: ${leadData.status}
- Temperatura Atual: ${leadData.temperature}
- Tipo: ${leadData.lead_type || "não especificado"}
- Tipo de Imóvel: ${leadData.property_type || "Não especificado"}
- Localização: ${leadData.location_preference || "Não especificada"}
- Orçamento: ${leadData.budget ? `€${leadData.budget.toLocaleString()}` : "Não especificado"}

**HISTÓRICO DE INTERAÇÕES (mais recente primeiro):**
${interactionsContext}

**NOTAS ANTERIORES (mais recente primeiro):**
${notesContext}

**TAREFAS JÁ ABERTAS PARA ESTA LEAD (por concluir):**
${openTasksContext}

**NOVO REGISTO (a novidade a analisar):**
"${newContent}"

**TAREFA 1 — Estado da lead:**
1. **summary**: Resume a novidade e o seu impacto em 2-3 frases.
2. **suggested_status**: Nova fase no pipeline. Usa EXATAMENTE um destes valores (são as fases configuradas nesta agência):
${pipelineStages.map((stage) => `   - "${stage}"`).join("\n")}
   Não inventes fases nem traduzas: devolve o identificador tal como está escrito acima.
   Se a novidade não justificar mudança, devolve o status atual.
3. **suggested_temperature**: "hot" (urgência, decisão iminente), "warm" (interesse sem pressa) ou "cold" (desinteresse, obstáculos). Se a novidade não justificar mudança, devolve a temperatura atual.

**TAREFA 2 — Dados de qualificação (extracted_data):**
Campos de qualificação desta lead, com o valor atual no CRM:
${qualificationContext}

Só inclui um campo em "extracted_data" se o novo registo o mencionar CLARA e EXPLICITAMENTE — nunca adivinhes, arredondes ou estimes. Se nada for mencionado sobre um campo, omite a chave por completo (não uses null nem string vazia).

**TAREFA 3 — Tarefas (tasks):**
Propõe no MÁXIMO 2 tarefas concretas e acionáveis que decorram diretamente da novidade (ex.: "Enviar proposta do T2 da Rua X"). Não repitas tarefas óbvias do histórico.
IMPORTANTE: compara com as "TAREFAS JÁ ABERTAS" acima — se a ação já estiver coberta por uma tarefa aberta (mesmo com palavras diferentes), NÃO a proponhas outra vez. Se tudo o que a novidade pede já tem tarefa aberta, devolve [].
Cada tarefa: { "title", "description", "due_date": "YYYY-MM-DD", "priority": "urgent"|"high"|"medium"|"low" }

**TAREFA 4 — Blocos de agenda (agenda_blocks):**
Cria um bloco de agenda sempre que o novo registo indicar data E hora concretas, tanto para compromissos já combinados como para pedidos do cliente:
- Compromissos: "visita sábado às 15h", "reunião dia 20 às 10:30"
- **Pedidos de contacto**: "quer ser contactado na quarta às 13:30", "pediu para ligar amanhã de manhã às 10h", "prefere que lhe telefonem 6ª às 17h" → bloco do tipo "call"

Um pedido do cliente para ser contactado a uma hora concreta É um compromisso — trata-o como tal.

Usa a data/hora atual acima para resolver referências relativas ("amanhã", "sábado", "quarta"). Referências a dias da semana significam SEMPRE a próxima ocorrência futura, nunca uma data que já passou.

NUNCA inventes compromissos nem horários — sem hora concreta, devolve [] e regista antes como tarefa.
Cada bloco: { "title", "description", "start_time": ISO 8601 com timezone de Lisboa, "end_time": ISO 8601 (por defeito 1 hora depois), "event_type": "viewing" (visita) | "meeting" (reunião) | "call" (chamada) | "followup" }

**TAREFA 5 — Próximas ações (next_actions):**
1 a 3 sugestões curtas e específicas para o consultor (texto livre, ex.: "Confirmar com o proprietário a disponibilidade para sábado"). Não repitas as tasks.

Responde APENAS com JSON válido (sem markdown), com EXATAMENTE esta estrutura:
{
  "summary": "string",
  "suggested_status": "string",
  "suggested_temperature": "string",
  "extracted_data": { "chave_do_campo": valor },
  "tasks": [{ "title": "string", "description": "string", "due_date": "YYYY-MM-DD", "priority": "string" }],
  "agenda_blocks": [{ "title": "string", "description": "string", "start_time": "string", "end_time": "string", "event_type": "string" }],
  "next_actions": ["string"]
}`;
}
