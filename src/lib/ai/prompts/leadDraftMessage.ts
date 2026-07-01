interface LeadDraftMessageContext {
  leadName: string;
  leadStatus: string | null;
  leadSource: string | null;
  notes: Array<{ note: string; created_at: string | null }> | null;
  channel: "whatsapp" | "email";
  relevantContext?: string[]; // RAG context from lead_memory
  lastMessage?: string; // Last message received from client
}

/**
 * Gera prompt para criar 3 variantes de resposta com tons diferentes
 */
export function getLeadDraftMessagePrompt(context: LeadDraftMessageContext): string {
  const channelInstructions = context.channel === 'whatsapp' 
    ? "Escreve mensagens de WhatsApp amigáveis, curtas e diretas, usando emojis quando apropriado. Não escrevas o campo de 'Assunto'."
    : "Escreve E-mails profissionais mas empáticos. Inclui um 'Assunto:' na primeira linha de cada variante.";

  const contextSection = context.relevantContext && context.relevantContext.length > 0
    ? `\n\nContexto relevante do histórico com o cliente (extraído por pesquisa semântica):
${context.relevantContext.join('\n\n')}`
    : `\n\nÚltimas notas do CRM sobre o cliente:
${JSON.stringify(context.notes || [], null, 2)}`;

  const lastMessageSection = context.lastMessage
    ? `\n\nÚltima mensagem recebida do cliente:
"${context.lastMessage}"

IMPORTANTE: A tua resposta deve responder diretamente a esta mensagem do cliente.`
    : "\n\nTarefas: Fazer follow-up e manter o contacto ativo com o cliente.";

  return `És um assistente comercial imobiliário expert.
Cria 3 VARIANTES de mensagem para responder ao cliente, cada uma com um tom diferente.

REGRA OBRIGATÓRIA — SEM DESPEDIDA NEM ASSINATURA:
A plataforma acrescenta automaticamente a assinatura do consultor a seguir ao teu texto. Por isso, em NENHUMA das 3 variantes podes escrever despedida, fecho ou assinatura de qualquer tipo. Isto inclui, mas não se limita a, frases como: "Com os melhores cumprimentos", "Com os meus melhores cumprimentos", "Cumprimentos", "Atenciosamente", "Melhores cumprimentos", "A equipa comercial", "A equipa [nome]", nome do consultor, cargo, ou nome da empresa. Cada variante termina diretamente na última frase útil da mensagem (ex.: um convite a responder, uma pergunta, uma disponibilidade) — sem nenhuma linha a seguir.

Dados do cliente:
Nome: ${context.leadName}
Status Atual: ${context.leadStatus}
Origem: ${context.leadSource}
${contextSection}
${lastMessageSection}

${channelInstructions}

Cria EXATAMENTE 3 variantes de resposta:

**VARIANTE 1 - TOM FORMAL**
Profissional, educado, estruturado. Usa linguagem mais formal e cortês.

**VARIANTE 2 - TOM PRÓXIMO**
Amigável, empático, caloroso. Como se fosses um consultor que conhece bem o cliente.

**VARIANTE 3 - TOM DIRETO**
Objetivo, conciso, vai direto ao ponto. Sem rodeios, mas sempre respeitoso.

FORMATO DA RESPOSTA (OBRIGATÓRIO):
---VARIANTE-1---
[texto da variante 1, a terminar na última frase útil — sem despedida nem assinatura]

---VARIANTE-2---
[texto da variante 2, a terminar na última frase útil — sem despedida nem assinatura]

---VARIANTE-3---
[texto da variante 3, a terminar na última frase útil — sem despedida nem assinatura]

Lembra-te: NÃO escrevas "Com os melhores cumprimentos", "A equipa comercial", nem qualquer outra despedida ou assinatura — a plataforma trata disso.
Responde EXCLUSIVAMENTE com as 3 variantes no formato acima, sem explicações adicionais.`;
}

// Frases de despedida/assinatura que a IA por vezes ainda escreve apesar da
// instrução no prompt. Usado como rede de segurança no servidor para as
// remover antes de a mensagem chegar ao ecrã, garantindo que só a assinatura
// configurada pelo consultor aparece no email.
const CLOSING_LINE_PATTERNS: RegExp[] = [
  /^com\s+(os\s+)?(meus\s+)?melhores\s+cumprimentos,?$/i,
  /^melhores\s+cumprimentos,?$/i,
  /^cumprimentos,?$/i,
  /^atenciosamente,?$/i,
  /^att\.?,?$/i,
  /^a\s+equipa(\s+comercial)?[.,]?$/i,
  /^a\s+equipa\s+d[aeo]\s+.+$/i,
  /^o\s+seu\s+consultor.*$/i,
  /^consultor(a)?\s+imobili[aá]rio.*$/i,
];

/**
 * Remove linhas finais de despedida/assinatura que a IA por vezes ainda gera
 * (ex.: "Com os melhores cumprimentos," seguido de "A equipa comercial"),
 * mesmo com a instrução explícita no prompt. Não altera o resto do texto.
 */
export function stripAiClosing(text: string): string {
  const lines = text.split(/\r?\n/);

  // Remove linhas vazias/em branco no fim antes de avaliar.
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  let removedAny = true;
  let guard = 0;
  while (removedAny && lines.length > 0 && guard < 6) {
    removedAny = false;
    guard++;
    const last = lines[lines.length - 1].trim();
    if (last === "") {
      lines.pop();
      removedAny = true;
      continue;
    }
    if (CLOSING_LINE_PATTERNS.some((pattern) => pattern.test(last))) {
      lines.pop();
      removedAny = true;
    }
  }

  return lines.join("\n").trim();
}