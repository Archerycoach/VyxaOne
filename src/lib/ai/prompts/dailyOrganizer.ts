interface DailySummaryContext {
  consultantName: string;
  overdueTasksCount: number;
  todayTasksCount: number;
  todayEventsCount: number;
  followUpDueCount: number;
  hotLeadsStaleCount: number;
  qualificationGapsCount: number;
  highlights: string[];
}

/**
 * Prompt leve para gerar apenas um resumo curto e priorizado do dia. A lista
 * de ações em si (tarefas, eventos, leads) já vem estruturada e deterministicamente
 * calculada pelo endpoint — a IA só acrescenta a camada de priorização e tom
 * humano, não inventa nem lista os itens em si.
 */
export function getDailySummaryPrompt(context: DailySummaryContext): string {
  return `És o assistente pessoal de ${context.consultantName}, um consultor imobiliário. Aqui está o panorama do dia dele:

- Tarefas atrasadas: ${context.overdueTasksCount}
- Tarefas para hoje: ${context.todayTasksCount}
- Eventos/compromissos hoje: ${context.todayEventsCount}
- Leads com follow-up agendado para hoje ou atrasado: ${context.followUpDueCount}
- Leads quentes sem contacto recente (risco de arrefecer): ${context.hotLeadsStaleCount}
- Leads quase totalmente qualificadas (só faltam alguns dados): ${context.qualificationGapsCount}

Destaques específicos:
${context.highlights.length > 0 ? context.highlights.map((h) => `- ${h}`).join("\n") : "- Sem destaques específicos hoje."}

Escreve um resumo de 2-3 frases, direto e encorajador, em português de Portugal, que diga claramente qual é a prioridade número um do dia e porquê. Não repitas os números todos — foca-te no que é mais importante agora. Não uses saudações genéricas tipo "Bom dia" nem linguagem de robô. Responde APENAS com o texto do resumo, sem markdown nem aspas.`;
}
