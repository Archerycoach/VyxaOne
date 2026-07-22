/**
 * Ajuste de valor pelo terreno, em moradias.
 *
 * O problema que resolve: o €/m² vem dos comparáveis, e esses JÁ incluem o
 * terreno deles. Somar o lote inteiro por cima contaria o mesmo valor duas
 * vezes. Mas ignorá-lo por completo — como acontecia — dava o mesmo valor a
 * uma moradia num lote de 400 m² e a outra igual num lote de 1200 m².
 *
 * O modelo valoriza apenas o EXCEDENTE face a um lote de referência: o lote
 * típico da zona está no preço dos comparáveis, e só o que passa disso (ou
 * fica aquém) altera o valor.
 */

export interface LandAdjustmentInput {
  /** Lote do imóvel a avaliar. */
  landArea?: number | null;
  /** Lote de referência. Derivado da área de construção quando não é dado. */
  referenceLandArea?: number | null;
  /** €/m² de terreno na zona. Obtido do Idealista, não escrito à mão. */
  landPricePerSqm?: number | null;
  /** Área de construção, para derivar o lote de referência. */
  builtArea?: number | null;
}

/**
 * Lote considerado "normal" para uma moradia, em múltiplos da área de
 * construção.
 *
 * Serve para não exigir ao consultor que saiba o lote típico da zona. Não é
 * uma medida exata — é o ponto a partir do qual o terreno deixa de estar
 * implícito no preço dos comparáveis e passa a ser um extra.
 */
const DEFAULT_LOT_RATIO = 3;

export interface LandAdjustmentResult {
  /** Valor a somar (ou subtrair) ao valor base. Zero quando não aplicável. */
  adjustment: number;
  excessSqm: number;
  applied: boolean;
  /** Frase pronta para o documento e para a IA. */
  explanation: string | null;
}

/**
 * Terreno em falta desvaloriza menos do que terreno a mais valoriza.
 *
 * Um lote acima do típico é um extra que o comprador paga com relutância
 * (não pode construir mais só por ter mais terreno); um lote abaixo do típico
 * é uma limitação real. Mas nenhum dos dois se traduz no valor cheio do
 * terreno, senão voltaríamos à dupla contagem.
 */
const SURPLUS_RATE = 0.6;
const DEFICIT_RATE = 0.8;

export function calculateLandAdjustment(input: LandAdjustmentInput): LandAdjustmentResult {
  const { landArea, landPricePerSqm, builtArea } = input;

  // Sem lote de referência explícito, deriva-se da área de construção.
  const referenceLandArea =
    input.referenceLandArea ?? (builtArea && builtArea > 0 ? builtArea * DEFAULT_LOT_RATIO : null);

  const notApplied: LandAdjustmentResult = {
    adjustment: 0,
    excessSqm: 0,
    applied: false,
    explanation: null,
  };

  if (!landArea || landArea <= 0) return notApplied;
  if (!referenceLandArea || referenceLandArea <= 0) return notApplied;
  if (!landPricePerSqm || landPricePerSqm <= 0) return notApplied;

  const excessSqm = landArea - referenceLandArea;

  // Diferenças pequenas não justificam mexer no valor — dariam uma falsa
  // precisão a partir de dois números que o consultor estimou.
  const threshold = referenceLandArea * 0.1;
  if (Math.abs(excessSqm) < threshold) {
    return {
      adjustment: 0,
      excessSqm,
      applied: false,
      explanation:
        `O lote de ${landArea.toLocaleString("pt-PT")} m² está em linha com o ` +
        `típico da zona (${referenceLandArea.toLocaleString("pt-PT")} m²), pelo que não altera o valor.`,
    };
  }

  const rate = excessSqm > 0 ? SURPLUS_RATE : DEFICIT_RATE;
  const adjustment = Math.round((excessSqm * landPricePerSqm * rate) / 1000) * 1000;

  const explanation =
    excessSqm > 0
      ? `O lote tem ${landArea.toLocaleString("pt-PT")} m², mais ${Math.round(excessSqm).toLocaleString("pt-PT")} m² ` +
        `do que o típico da zona (${referenceLandArea.toLocaleString("pt-PT")} m²). ` +
        `Esse excedente acrescenta cerca de ${adjustment.toLocaleString("pt-PT")} € ao valor.`
      : `O lote tem ${landArea.toLocaleString("pt-PT")} m², menos ${Math.round(Math.abs(excessSqm)).toLocaleString("pt-PT")} m² ` +
        `do que o típico da zona (${referenceLandArea.toLocaleString("pt-PT")} m²), ` +
        `o que reduz o valor em cerca de ${Math.abs(adjustment).toLocaleString("pt-PT")} €.`;

  return { adjustment, excessSqm, applied: true, explanation };
}
