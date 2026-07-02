import { QUALIFICATION_FIELD_VALUE_HINTS, type QualificationFieldContext } from "@/lib/leadQualification";

interface NotesFieldExtractionContext {
  leadName: string;
  notesText: string;
  /** Campos de qualificação relevantes para esta lead, com o valor atual conhecido. */
  qualificationFields: QualificationFieldContext[];
}

/**
 * Prompt para extrair dados de qualificação a partir das notas de uma lead
 * (ex.: respostas de um formulário da Meta que não bateram com nenhuma
 * regra fixa de mapeamento, ou notas escritas livremente pelo consultor).
 * Mesmo catálogo e filosofia da análise de notas de voz — só que a fonte é
 * texto já escrito, não uma transcrição de áudio.
 */
export function getNotesFieldExtractionPrompt(context: NotesFieldExtractionContext): string {
  const qualificationContext = context.qualificationFields
    .map((f) => `- ${f.key}: "${f.label}" — valor atual no CRM: ${f.currentValue}. Formato esperado: ${QUALIFICATION_FIELD_VALUE_HINTS[f.key] || "texto livre"}.`)
    .join("\n");

  return `Tens acesso às notas guardadas sobre a lead "${context.leadName}" num CRM imobiliário. Estas notas podem incluir respostas de formulários (ex.: Meta/Facebook Ads) que não foram automaticamente mapeadas para os campos do CRM, ou anotações livres do consultor.

NOTAS:
"""
${context.notesText}
"""

Estes são os campos de qualificação desta lead, com o valor atual no CRM:
${qualificationContext}

Para cada um destes campos, verifica se as notas mencionam CLARA e EXPLICITAMENTE essa informação. Só inclui um campo em "extracted_data" se tiveres a certeza — nunca adivinhes, arredondes ou estimes valores que não estão escritos. Se as notas não mencionarem nada sobre um campo, NÃO o incluas no objeto (não uses null nem string vazia — omite a chave por completo).

Responde APENAS com JSON válido (sem markdown), com EXATAMENTE esta estrutura:
{
  "extracted_data": {
    "chave_do_campo": valor
  }
}`;
}
