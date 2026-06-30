interface VoiceNoteAnalysisContext {
  transcription: string;
  leadData: {
    name: string;
    status: string;
    temperature: string;
    property_type?: string;
    location_preference?: string;
    budget?: number;
  };
  recentInteractions: any[];
}

export function getVoiceNoteAnalysisPrompt(context: VoiceNoteAnalysisContext): string {
  const { transcription, leadData, recentInteractions } = context;

  const interactionsContext = recentInteractions.length > 0
    ? recentInteractions.map((int, idx) => 
        `${idx + 1}. [${new Date(int.interaction_date).toLocaleDateString("pt-PT")}] ${int.interaction_type}: ${int.content?.substring(0, 150) || int.outcome}`
      ).join("\n")
    : "Sem interações anteriores registadas.";

  return `És um assistente IA especializado em CRM imobiliário. O consultor acabou de gravar uma nota de voz após interagir com uma lead.

**LEAD:**
- Nome: ${leadData.name}
- Status Atual: ${leadData.status}
- Temperatura Atual: ${leadData.temperature}
- Tipo de Imóvel: ${leadData.property_type || "Não especificado"}
- Localização: ${leadData.location_preference || "Não especificada"}
- Orçamento: ${leadData.budget ? `€${leadData.budget.toLocaleString()}` : "Não especificado"}

**HISTÓRICO RECENTE:**
${interactionsContext}

**TRANSCRIÇÃO DA NOTA DE VOZ:**
"${transcription}"

**TAREFA:**
Analisa a nota de voz e extrai informação estruturada para atualizar o CRM automaticamente.

**INSTRUÇÕES:**
1. **summary**: Resume a interação em 2-3 frases (o que aconteceu, principais pontos discutidos).
2. **suggested_status**: Sugere o novo status no pipeline com base na interação. Valores possíveis:
   - "new" = Lead acabou de entrar
   - "contacted" = Primeiro contacto feito
   - "qualified" = Lead qualificada, necessidades claras
   - "proposal" = Proposta/imóveis enviados
   - "negotiation" = Em negociação de valores/condições
   - "won" = Negócio fechado
   - "lost" = Lead perdida
3. **suggested_temperature**: Avalia o nível de interesse/urgência. Valores possíveis:
   - "hot" = Alta urgência, pronto para avançar, muito interessado
   - "warm" = Interesse moderado, precisa de acompanhamento
   - "cold" = Baixo interesse, pouco envolvimento
4. **suggested_task**: Se aplicável, sugere uma próxima ação concreta:
   - title: Título curto da tarefa (ex: "Enviar proposta de apartamento T2")
   - description: Descrição detalhada do que fazer
   - due_date: Data sugerida no formato ISO (YYYY-MM-DD), considerando urgência
   - priority: "urgent", "high", "medium", ou "low"
   - Se não houver ação clara, retorna null
5. **confidence**: Nível de confiança na análise (0.0 a 1.0).

**CRITÉRIOS DE DECISÃO:**
- Se o consultor mencionar "visitou", "viu o imóvel", "gostou" → status pode ser "qualified" ou "proposal"
- Se mencionar "valores", "preço", "negociar" → status pode ser "negotiation"
- Se mencionar "não interessado", "desistiu" → status pode ser "lost"
- Se mencionar "fechou", "assinou", "comprou" → status "won"
- Temperatura "hot" = urgência, prazos curtos, decisão iminente
- Temperatura "warm" = interesse mas sem pressa
- Temperatura "cold" = desinteresse, dificuldades, obstáculos

**OUTPUT:**
Responde APENAS com JSON válido (sem markdown):
{
  "summary": "string",
  "suggested_status": "string",
  "suggested_temperature": "string",
  "suggested_task": {
    "title": "string",
    "description": "string",
    "due_date": "YYYY-MM-DD",
    "priority": "string"
  } | null,
  "confidence": number
}`;
}