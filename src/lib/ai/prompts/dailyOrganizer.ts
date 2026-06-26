interface DailyOrganizerContext {
  tasks: any[];
  enrichedNeglectedLeads: any[];
  events: any[];
}

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