/**
 * Mala-direta por lista (Excel/CSV): cada coluna do ficheiro vira uma variável
 * {token} usável no assunto e no corpo do email, e é substituída linha a linha
 * pelo valor dessa linha — o mesmo modelo do Word > Excel > Outlook.
 *
 * O token é derivado do cabeçalho da coluna de forma estável (minúsculas, sem
 * acentos, espaços → underscore), para que "Primeiro Nome" no Excel se torne
 * {primeiro_nome} no editor e na escrita da IA.
 */

/** Cabeçalho de coluna → token de variável estável ("Primeiro Nome" → "primeiro_nome"). */
export function normalizeVarToken(header: string): string {
  return String(header ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Substitui {token} pelos valores da linha. Tolerante a maiúsculas/minúsculas,
 * acentos e espaços dentro das chavetas ({Primeiro Nome} = {primeiro_nome}).
 * O que não corresponder a uma variável conhecida fica intacto — não apaga
 * texto entre chavetas que não seja uma variável.
 */
export function personalizeMailMerge(text: string, vars: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\s*([^{}]+?)\s*\}/g, (match, rawName: string) => {
    const token = normalizeVarToken(rawName);
    if (Object.prototype.hasOwnProperty.call(vars, token)) {
      return vars[token] ?? "";
    }
    return match;
  });
}
