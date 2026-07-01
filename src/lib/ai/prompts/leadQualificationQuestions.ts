interface LeadQualificationQuestionsPromptContext {
  leadName: string;
  leadType: string | null;
  knownData: Record<string, unknown>;
  missingFieldLabels: string[];
  notesHistory: unknown[];
  interactionsHistory: unknown[];
}

/**
 * Gera prompt para transformar uma lista de dados em falta (já detetados de
 * forma determinística, ver src/lib/leadQualification.ts) em perguntas
 * naturais, prontas a enviar ao cliente por email ou WhatsApp.
 */
export function getLeadQualificationQuestionsPrompt(context: LeadQualificationQuestionsPromptContext): string {
  return `És um assistente comercial imobiliário expert. A lead "${context.leadName}" tem dados de qualificação em falta no CRM.

DADOS JÁ CONHECIDOS SOBRE A LEAD:
${JSON.stringify(context.knownData, null, 2)}

NOTAS E INTERAÇÕES RECENTES (contexto para o tom das perguntas):
${JSON.stringify({ notas: context.notesHistory, interacoes: context.interactionsHistory }, null, 2)}

DADOS EM FALTA que é preciso perguntar ao cliente:
${context.missingFieldLabels.map((label, i) => `${i + 1}. ${label}`).join("\n")}

Para CADA um destes dados em falta, gera UMA pergunta curta, natural e simpática, em português de Portugal, que o consultor possa enviar ao cliente por email ou WhatsApp para obter essa informação. As perguntas devem soar como parte de uma conversa real com um cliente, nunca como um formulário — usa os dados já conhecidos sempre que ajudar a soar mais natural e específica (ex.: referir o tipo de imóvel ou zona já mencionados).

Responde APENAS em JSON válido, com EXATAMENTE esta estrutura (sem texto antes ou depois), com uma pergunta por cada dado em falta, pela MESMA ORDEM da lista acima:
{
  "questions": ["pergunta 1", "pergunta 2"]
}`;
}
