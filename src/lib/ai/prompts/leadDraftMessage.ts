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
[texto da variante 1]

---VARIANTE-2---
[texto da variante 2]

---VARIANTE-3---
[texto da variante 3]

IMPORTANTE sobre a despedida/assinatura: NÃO escrevas nenhuma despedida final (ex.: "Com os melhores cumprimentos", "Atentamente", "A equipa comercial") nem qualquer assinatura. A assinatura do consultor é adicionada automaticamente pela aplicação a seguir. Termina a mensagem na última frase útil do conteúdo, sem fecho nem nome.
Responde EXCLUSIVAMENTE com as 3 variantes no formato acima, sem explicações adicionais.`;
}