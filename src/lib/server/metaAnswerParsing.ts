/**
 * Interpreta a resposta de uma pergunta de escolha múltipla da Meta como um
 * booleano de três estados (true | false | null — "não sei").
 *
 * A versão anterior só reconhecia "sim"/"não"/"yes"/"no"/"true"/"1" e tratava
 * QUALQUER outra resposta como false — o que transformava respostas de
 * indecisão ("Ainda estou a avaliar as hipóteses") num "não precisa de
 * crédito" inventado. Aqui, o que não se reconhece com confiança fica null
 * (por preencher), nunca false por omissão — a mesma regra já usada no resto
 * da app para não gravar um facto que não foi realmente dito (ver a
 * validação do orçamento em meta/webhook.ts).
 */
export function parseMetaTriStateAnswer(value: string): boolean | null {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos, para "não"/"nao" baterem certo

  if (["sim", "s", "yes", "y", "true", "1"].includes(normalized)) return true;
  if (["nao", "n", "no", "false", "0"].includes(normalized)) return false;

  // Frases típicas de perguntas Meta sobre situação de crédito/financiamento
  // — cobre "Crédito pré-aprovado" e "Vou tratar do crédito quando encontrar
  // o imóvel certo" (ambas significam que vai recorrer a crédito, só muda se
  // já está tratado).
  if (
    /pre[- ]?aprovad|aprovad|recorrer a credito|vou tratar do credito|com financiamento|com credito|precis[ao] de credito|precis[ao] de financiamento/.test(
      normalized
    )
  ) {
    return true;
  }

  // Sinais claros do contrário — compra a pronto pagamento.
  if (/pronto pagamento|a pronto|\bcash\b|sem credito|sem financiamento|nao vou precisar/.test(normalized)) {
    return false;
  }

  // Qualquer outra coisa — incluindo respostas de indecisão como "Ainda
  // estou a avaliar as hipóteses" — fica por preencher. Não inventamos um
  // "não precisa" a partir de "ainda não sei".
  return null;
}

export type FinancingStatus = "pre_approved" | "will_arrange" | "evaluating";

/**
 * Reconhece as três opções típicas da pergunta Meta "Qual destas opções
 * descreve melhor a sua situação?" sobre crédito, e devolve o valor canónico
 * usado na ficha da lead (leads.financing_status). Só devolve um valor
 * quando reconhece a frase com confiança — uma resposta de texto livre
 * qualquer fica null (a UI mostra o texto em bruto nesse caso, não este
 * campo canónico).
 */
export function parseFinancingStatus(value: string): FinancingStatus | null {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (/pre[- ]?aprovad/.test(normalized)) return "pre_approved";

  if (/vou tratar do credito|tratar do credito|recorrer a credito quando/.test(normalized)) {
    return "will_arrange";
  }

  if (/ainda estou a avaliar|a avaliar as hipoteses|ainda a avaliar|ainda nao sei|ainda não sei/.test(normalized)) {
    return "evaluating";
  }

  return null;
}
