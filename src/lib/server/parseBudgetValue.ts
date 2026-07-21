/**
 * Interpretação de valores de orçamento vindos de campos de texto livre
 * (formulários da Meta, importações, notas).
 *
 * A versão anterior removia TODOS os pontos antes de ler o número. Num valor
 * como "400.000.00" — milhares por ponto e decimais por ponto, formato que a
 * Meta devolve consoante a locale do utilizador — isso produzia 40 000 000.
 * Corrompeu orçamentos na base durante meses, e como o `budget_max` decide
 * quem recebe campanhas, leads legítimas ficaram de fora (tecto de 4 500 €) ou
 * entraram em tudo (tecto de 50 000 000 €).
 *
 * Regras, por ordem:
 *  1. Um separador decimal (ponto ou vírgula) seguido de 1-2 dígitos NO FIM de
 *     cada número é descartado — são cêntimos, não milhares.
 *  2. Os restantes pontos/espaços são separadores de milhares.
 *  3. Num intervalo ("150.000 - 200.000") vale o valor mais alto.
 *  4. Valores abaixo de 1000 seguem a convenção portuguesa ("300" = 300 mil).
 *  5. O resultado tem de ser plausível para imobiliário; se não for, devolve
 *     null para o chamador guardar o texto original em notas em vez de gravar
 *     um número errado.
 */

/** Abaixo disto não é um orçamento de compra; acima, é erro de interpretação. */
const MIN_PLAUSIBLE = 10_000;
const MAX_PLAUSIBLE = 20_000_000;

export interface ParsedBudget {
  value: number | null;
  /** Motivo de rejeição, para registo/diagnóstico. */
  rejected?: "no_digits" | "implausible";
  /** O que foi lido antes da verificação de plausibilidade. */
  rawParsed?: number;
}

export function parseBudgetValue(input: string | number | null | undefined): ParsedBudget {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= MIN_PLAUSIBLE && input <= MAX_PLAUSIBLE
      ? { value: input }
      : { value: null, rejected: "implausible", rawParsed: Number(input) };
  }

  const text = String(input ?? "").trim();
  if (!text) return { value: null, rejected: "no_digits" };

  // Cada "número" do texto, ainda com separadores.
  const chunks = text.match(/\d[\d.,\s]*\d|\d/g);
  if (!chunks || chunks.length === 0) {
    return { value: null, rejected: "no_digits" };
  }

  const numbers: number[] = [];

  for (const chunk of chunks) {
    let cleaned = chunk.replace(/\s/g, "");

    // Passo 1: decimais no fim (",00" ou ".00"). Só conta como decimal se
    // vier no FIM — "400.000" é quatrocentos mil, "400.00" é 400.
    const decimalMatch = cleaned.match(/^(.*)[.,](\d{1,2})$/);
    let hadDecimals = false;
    if (decimalMatch) {
      const head = decimalMatch[1];
      // "1.234" é milhares (3 dígitos depois do separador nunca cai aqui);
      // mas "45.00" e "400.000.00" caem, e é isso que se quer descartar.
      if (/[.,]/.test(head) || head.replace(/[.,]/g, "").length >= 2) {
        cleaned = head;
        hadDecimals = true;
      }
    }

    // Passo 2: o que sobra são separadores de milhares.
    const digits = cleaned.replace(/[.,]/g, "");
    if (!digits) continue;

    let value = parseInt(digits, 10);
    if (!Number.isFinite(value)) continue;

    // Passo 3: convenção "300" = 300 mil. Não se aplica quando o valor trazia
    // decimais — quem escreve "450,00" quer 450, não 450 mil.
    if (value < 1000 && !hadDecimals) {
      value = value * 1000;
    }

    numbers.push(value);
  }

  if (numbers.length === 0) {
    return { value: null, rejected: "no_digits" };
  }

  // Num intervalo, o topo é o que interessa para um orçamento máximo.
  const parsed = Math.max(...numbers);

  if (parsed < MIN_PLAUSIBLE || parsed > MAX_PLAUSIBLE) {
    return { value: null, rejected: "implausible", rawParsed: parsed };
  }

  return { value: parsed };
}
