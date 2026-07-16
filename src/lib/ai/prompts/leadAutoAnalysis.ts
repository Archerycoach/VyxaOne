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
  /** Campos de qualificação relevantes para esta lead, com o valor atual conhecido. */
  qualificationFields: QualificationFieldContext[];
}

const TRIGGER_LABELS: Record<LeadAutoAnalysisContext["trigger"], string> = {
  note: "uma nota escrita",
  interaction: "o registo de uma interação (chamada, email, reunião, etc.)",
  voice_note: "a transcrição de uma nota de voz gravada após um contacto",
};

export function getLeadAutoAnalysisPrompt(context: LeadAutoAnalysisContext): string {
  const { newContent, trigger, leadData, recentInteractions, recentNotes, qualificationFields } = context;

  const now = new Date();
  const nowStr = now.toISOString();

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

  const qualificationContext = qualificationFields.length > 0
    ? qualificationFields
        .map((f) => `- ${f.key}: "${f.label}" — valor atual no CRM: ${f.currentValue}. Formato esperado: ${QUALIFICATION_FIELD_VALUE_HINTS[f.key] || "texto livre"}.`)
        .join("\n")
    : "Nenhum campo de qualificação aplicável a esta lead.";

  return `És um assistente IA de um CRM imobiliário português. O consultor acabou de adicionar ${TRIGGER_LABELS[trigger]} a uma lead. Analisa a novidade no contexto do histórico e atualiza o CRM.

Data e hora atuais: ${nowStr}

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

**NOVO REGISTO (a novidade a analisar):**
"${newContent}"

**TAREFA 1 — Estado da lead:**
1. **summary**: Resume a novidade e o seu impacto em 2-3 frases.
2. **suggested_status**: Novo status no pipeline. Valores possíveis:
   - "new" = Lead acabou de entrar
   - "contacted" = Primeiro contacto feito
   - "qualified" = Lead qualificada, necessidades claras
   - "proposal" = Proposta/imóveis enviados
   - "negotiation" = Em negociação de valores/condições
   - "won" = Negócio fechado
   - "lost" = Lead perdida
   Se a novidade não justificar mudança, devolve o status atual.
3. **suggested_temperature**: "hot" (urgência, decisão iminente), "warm" (interesse sem pressa) ou "cold" (desinteresse, obstáculos). Se a novidade não justificar mudança, devolve a temperatura atual.

**TAREFA 2 — Dados de qualificação (extracted_data):**
Campos de qualificação desta lead, com o valor atual no CRM:
${qualificationContext}

Só inclui um campo em "extracted_data" se o novo registo o mencionar CLARA e EXPLICITAMENTE — nunca adivinhes, arredondes ou estimes. Se nada for mencionado sobre um campo, omite a chave por completo (não uses null nem string vazia).

**TAREFA 3 — Tarefas (tasks):**
Propõe no MÁXIMO 2 tarefas concretas e acionáveis que decorram diretamente da novidade (ex.: "Enviar proposta do T2 da Rua X"). Não repitas tarefas óbvias do histórico. Se não houver ação clara, devolve [].
Cada tarefa: { "title", "description", "due_date": "YYYY-MM-DD", "priority": "urgent"|"high"|"medium"|"low" }

**TAREFA 4 — Blocos de agenda (agenda_blocks):**
APENAS se o novo registo mencionar um compromisso com data E hora concretas (ex.: "visita sábado às 15h", "reunião dia 20 às 10:30"), cria um bloco de agenda. Usa a data/hora atual acima para resolver referências relativas ("amanhã", "sábado"). NUNCA inventes compromissos nem horários — na dúvida, devolve [].
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
