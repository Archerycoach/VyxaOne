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
 * Prompt leve para gerar apenas um resumo curto e priorizado do dia, usado
 * pelo hub "O Meu Dia" (src/pages/ai-organizer.tsx). A lista de ações em si
 * (tarefas, eventos, leads) já vem estruturada e deterministicamente
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

interface DailyOrganizerContext {
  tasks: any[];
  enrichedNeglectedLeads: any[];
  events: any[];
}

/**
 * Prompt original de plano de ação em texto livre. Continua em uso por
 * src/pages/api/cron/gpt-assistant.ts (resumo diário por email) e
 * src/pages/api/gpt/manual-run.ts — mantido tal como estava, sem alterações,
 * para não quebrar essas duas automações.
 */
export function getDailyOrganizerPrompt(context: DailyOrganizerContext): {
  system: string;
  user: string;
} {
  const systemPrompt = `És um Assistente Organizador Pessoal de um consultor imobiliário.
Analisa os dados fornecidos e cria um plano de ação curto, direto e altamente acionável.
Regras:
1. Começa com uma saudação encorajadora.
2. Destaca o evento ou tarefa mais crítica do dia.
3. Se houver leads esquecidos, lê SEMPRE as notas e o histórico completo de interações antes de aconselhar o próximo follow-up.
4. Usa o histórico para sugerir o canal certo, a urgência e a melhor próxima interação.
5. Usa formatação limpa (listas) e uma linguagem muito objetiva, sem conversa de "robô".
6. Não inventes dados que não estejam abaixo.`;

  const userPrompt = `Aqui estão os meus dados atuais:
Tarefas pendentes: ${JSON.stringify(context.tasks || [])}
Leads a arrefecer (sem atividade >30 dias, com notas e histórico completo): ${JSON.stringify(context.enrichedNeglectedLeads || [])}
Eventos para hoje: ${JSON.stringify(context.events || [])}

Diz-me exatamente o que devo fazer primeiro e como estruturar o meu dia. Quando sugerires um follow-up a uma lead, justifica-o com base no histórico real dessa lead.`;

  return { system: systemPrompt, user: userPrompt };
}
