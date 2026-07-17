/**
 * Prompt para o Agente IA interpretar um pedido de ALTERAÇÃO de leads feito na
 * conversa (ex.: "muda a tipologia da Ana para T3", "associa cada uma destas
 * leads ao empreendimento certo", "executa as 7 que batem certo"). Devolve uma
 * PROPOSTA estruturada de EDIÇÕES POR LEAD (cada lead pode ter os seus próprios
 * valores) — nunca grava; quem grava é o consultor, ao confirmar.
 *
 * Usado por src/lib/server/leadChatUpdate.ts (task lead_chat_update, jsonMode).
 */

interface LeadForPrompt {
  id: string;
  name: string;
  status?: string | null;
  temperature?: string | null;
  location_preference?: string | null;
  typology?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface HistoryMsg {
  role: "user" | "assistant" | "system";
  content: string;
}

export function getLeadChatUpdatePrompt(params: {
  message: string;
  leads: LeadForPrompt[];
  history?: HistoryMsg[];
}): string {
  const { message, leads, history } = params;

  const leadsList = leads
    .map((l) =>
      `- id:${l.id} | ${l.name} | estado:${l.status || "—"} | temp:${l.temperature || "—"} | zona:${l.location_preference || "—"} | tipologia:${l.typology || "—"} | email:${l.email || "—"} | tel:${l.phone || "—"}`
    )
    .join("\n");

  const historyBlock = (history || [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Consultor" : "Agente"}: ${m.content}`)
    .join("\n");

  return `És o Agente IA de um CRM imobiliário português. O consultor pediu para ALTERAR uma ou mais leads. Interpreta o pedido e devolve uma PROPOSTA de edições — nunca confirmas nem gravas nada (isso é feito depois pelo consultor).

**PEDIDO ATUAL DO CONSULTOR:**
"${message}"

${historyBlock ? `**CONVERSA RECENTE (para resolver referências como "as 7 que batem certo", "essas leads", "as que falámos"):**\n${historyBlock}\n` : ""}

**LEADS DISPONÍVEIS (só podes atuar sobre estas):**
${leadsList || "(nenhuma lead)"}

**CAMPOS EDITÁVEIS** (usa exatamente estas chaves; ignora tudo o que não esteja aqui):
- name: string · email: string (válido) · phone: string
- status: "new"|"contacted"|"qualified"|"proposal"|"negotiation"|"won"|"lost"
- temperature: "hot"|"warm"|"cold"
- budget / budget_min / budget_max: inteiro em euros
- typology: "T0"|"T1"|"T2"|"T3"|"T4"|"T5+" · bedrooms: inteiro · bathrooms: inteiro
- location_preference: string
- property_type: "apartment"|"house"|"land"|"commercial"|"store"|"office"|"warehouse"
- buy_purpose: "housing"|"investment"|"secondary" · purchase_timeline: string
- needs_financing: true/false · notes: string
- development_name: string (nome do empreendimento a associar; null para desassociar)

**REGRAS:**
1. Devolve uma lista "edits", em que CADA elemento é { "leadId": "<id>", "updates": { ...campos... } }. Cada lead pode ter valores DIFERENTES (ex.: associar cada lead ao seu próprio empreendimento). Só ids da lista acima.
2. Em "updates" inclui APENAS os campos a alterar nessa lead, nos formatos indicados. Converte linguagem natural (ex.: "quente"→"hot", "qualificada"→"qualified", "300 mil"→300000).
3. Usa a CONVERSA RECENTE para resolver referências. Se o Agente já listou leads e as suas correspondências (ex.: lead → development_name), e o consultor diz "executa"/"avança"/"faz as que batem certo", produz os edits correspondentes a essas leads.
4. Se NÃO conseguires identificar com segurança as leads OU o que alterar, devolve "needsClarification" com uma pergunta curta e "edits": []. Nunca adivinhes.
5. "summary": frase curta em português a resumir o que vai mudar e em quantas leads.

Responde APENAS com JSON válido (sem markdown), com esta estrutura EXATA:
{
  "edits": [ { "leadId": "string", "updates": { "chave": valor } } ],
  "summary": "string",
  "needsClarification": "string ou null"
}`;
}
