export interface QualificationFieldContext {
  key: string;
  label: string;
  currentValue: string;
}

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
  /** Campos de qualificação relevantes para esta lead (ver src/lib/leadQualification.ts), com o valor atual conhecido. */
  qualificationFields: QualificationFieldContext[];
}

// Indica à IA o tipo/formato de valor esperado para cada campo de
// qualificação, para que o "extracted_data" saia já pronto a gravar na base
// de dados sem conversões adicionais.
const FIELD_VALUE_HINTS: Record<string, string> = {
  property_type: 'string — um destes valores exatos: "apartment", "house", "land", "commercial", "store", "office", "warehouse"',
  buy_purpose: 'string — um destes valores exatos: "housing" (habitação própria), "investment" (investimento), "secondary" (habitação secundária)',
  purchase_timeline: 'string curta em português, ex: "imediato", "3-6 meses", "1 ano"',
  budget: "número inteiro em euros (sem símbolos nem pontos), o valor máximo que a lead mencionou poder gastar",
  needs_financing: "true ou false (boolean)",
  has_property_to_sell: "true ou false (boolean)",
  bathrooms: "número inteiro de casas de banho do imóvel a vender",
  property_area: "número em m² do imóvel a vender",
  desired_price: "número inteiro em euros, preço pretendido na venda",
  typology: 'string — um destes valores exatos: "T0", "T1", "T2", "T3", "T4", "T5+"',
  location_preference: "string curta com a localização mencionada (zona/cidade)",
};

export function getVoiceNoteAnalysisPrompt(context: VoiceNoteAnalysisContext): string {
  const { transcription, leadData, recentInteractions, qualificationFields } = context;

  const interactionsContext = recentInteractions.length > 0
    ? recentInteractions.map((int, idx) => 
        `${idx + 1}. [${new Date(int.interaction_date).toLocaleDateString("pt-PT")}] ${int.interaction_type}: ${int.content?.substring(0, 150) || int.outcome}`
      ).join("\n")
    : "Sem interações anteriores registadas.";

  const qualificationContext = qualificationFields.length > 0
    ? qualificationFields
        .map((f) => `- ${f.key}: "${f.label}" — valor atual no CRM: ${f.currentValue}. Formato esperado: ${FIELD_VALUE_HINTS[f.key] || "texto livre"}.`)
        .join("\n")
    : "Nenhum campo de qualificação aplicável a esta lead.";

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

**TAREFA 1 — Estado da lead:**
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

**TAREFA 2 — Dados de qualificação (extracted_data):**
Estes são os campos de qualificação desta lead, com o valor atual no CRM:
${qualificationContext}

Para cada um destes campos, verifica se a transcrição menciona CLARA e EXPLICITAMENTE essa informação (seja para preencher um campo em falta, seja para atualizar um valor já existente que mudou). Só inclui um campo em "extracted_data" se tiveres a certeza — nunca adivinhes, arredondes ou estimes valores que não foram ditos. Se a transcrição não mencionar nada sobre um campo, NÃO o incluas no objeto (não uses null nem string vazia — omite a chave por completo).

Responde APENAS com JSON válido (sem markdown), com EXATAMENTE esta estrutura:
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
  "confidence": number,
  "extracted_data": {
    "chave_do_campo": valor
  }
}`;
}