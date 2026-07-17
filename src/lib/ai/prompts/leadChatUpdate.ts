/**
 * Prompt para o Agente IA interpretar um pedido de ALTERAÇÃO de leads feito na
 * conversa (ex.: "muda a tipologia da Ana para T3", "marca como quentes as
 * leads de Matosinhos"). Devolve uma PROPOSTA estruturada (nunca grava) —
 * quem grava é o utilizador, ao confirmar.
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

export function getLeadChatUpdatePrompt(params: {
  message: string;
  leads: LeadForPrompt[];
}): string {
  const { message, leads } = params;

  const leadsList = leads
    .map((l) =>
      `- id:${l.id} | ${l.name} | estado:${l.status || "—"} | temp:${l.temperature || "—"} | zona:${l.location_preference || "—"} | tipologia:${l.typology || "—"} | email:${l.email || "—"} | tel:${l.phone || "—"}`
    )
    .join("\n");

  return `És o Agente IA de um CRM imobiliário português. O consultor pediu para ALTERAR uma ou mais leads. A tua função é interpretar o pedido e devolver uma PROPOSTA de alteração — nunca confirmas nem gravas nada (isso é feito depois pelo consultor).

**PEDIDO DO CONSULTOR:**
"${message}"

**LEADS DISPONÍVEIS (só podes atuar sobre estas):**
${leadsList || "(nenhuma lead)"}

**CAMPOS EDITÁVEIS** (usa exatamente estas chaves; ignora tudo o que não esteja aqui):
- name: string (nome da lead)
- email: string (email válido)
- phone: string (telefone)
- status: um de "new","contacted","qualified","proposal","negotiation","won","lost"
- temperature: um de "hot" (quente), "warm" (morna), "cold" (fria)
- budget: número inteiro em euros (orçamento máximo)
- budget_min: número inteiro em euros
- budget_max: número inteiro em euros
- typology: um de "T0","T1","T2","T3","T4","T5+"
- bedrooms: número inteiro de quartos
- bathrooms: número inteiro
- location_preference: string (zona/cidade)
- property_type: um de "apartment","house","land","commercial","store","office","warehouse"
- buy_purpose: um de "housing","investment","secondary"
- purchase_timeline: string curta (ex.: "imediato","3-6 meses")
- needs_financing: true/false
- notes: string (nota livre)
- development_name: string (nome do empreendimento a associar; para desassociar usa null)

**REGRAS:**
1. Identifica as leads-alvo pelos nomes/critérios do pedido, devolvendo os ids exatos em "targetLeadIds". Se o pedido for em massa por um critério (zona, estado, etc.), inclui todos os ids que correspondem. Só ids da lista acima.
2. Em "updates", inclui APENAS os campos a alterar, com os valores no formato indicado. Converte linguagem natural para os valores exatos (ex.: "quente"→"hot", "qualificada"→"qualified", "300 mil"→300000).
3. Se NÃO conseguires identificar com segurança a(s) lead(s) OU o que alterar, devolve "needsClarification" com uma pergunta curta e deixa "targetLeadIds" e "updates" vazios. Nunca adivinhes uma lead errada.
4. "summary": frase curta em português a descrever o que vai ser alterado e em quantas leads (ex.: "Alterar a tipologia para T3 na lead Ana Ferreira." ou "Marcar como Quente 4 leads de Matosinhos.").

Responde APENAS com JSON válido (sem markdown), com esta estrutura EXATA:
{
  "targetLeadIds": ["..."],
  "updates": { "chave": valor },
  "summary": "string",
  "needsClarification": "string ou null"
}`;
}
