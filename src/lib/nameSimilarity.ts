/**
 * Semelhança entre nomes de pessoas, para sugerir leads possivelmente
 * duplicadas quando o telefone e o email não coincidem (a mesma pessoa a
 * entrar por dois portais com contactos diferentes).
 *
 * Nota deliberada: isto NÃO usa IA. Para comparar nomes, uma medida
 * determinística é melhor do que um modelo — é instantânea, não custa nada por
 * comparação (seriam N² chamadas), e dá sempre o mesmo resultado para os
 * mesmos dados, o que é essencial quando se está a propor fundir registos.
 */

/** Partículas que não distinguem pessoas ("Maria DE Sousa" ≡ "Maria Sousa"). */
const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

/** Remove acentos, pontuação e maiúsculas. */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    // Marcas diacríticas combinatórias (U+0300–U+036F).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significativos do nome, sem partículas nem iniciais soltas. */
export function nameTokens(name: string | null | undefined): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((token) => token.length > 1 && !PARTICLES.has(token));
}

/** Distância de Levenshtein (para apanhar gralhas: "Sousa" / "Souza"). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous = current;
  }

  return previous[b.length];
}

/** Dois tokens são "o mesmo" se forem iguais ou diferirem por uma gralha. */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 4) return false; // nomes curtos: exigir igualdade exata
  const allowed = maxLen >= 8 ? 2 : 1;
  return levenshtein(a, b) <= allowed;
}

/**
 * Semelhança entre dois nomes, de 0 a 1.
 *
 * Exige que o PRIMEIRO nome corresponda e mede depois a proporção de nomes
 * partilhados sobre o nome mais curto. É isto que distingue:
 *   "Eduardo Telles Santos" / "Eduardo Santos"  → 1.00 (mesma pessoa)
 *   "Pedro Alves" / "Pedro Alves Costa"         → 1.00 (apelido acrescentado)
 *   "Eduardo Santos" / "Eduardo Costa"          → 0.50 (abaixo do limiar)
 *   "Eduardo Santos" / "Ana Santos"             → 0.00 (primeiro nome difere)
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Primeiro nome tem de bater — sem isto, qualquer apelido comum juntava
  // pessoas diferentes ("Eduardo Santos" e "Ana Santos").
  if (!tokensMatch(tokensA[0], tokensB[0])) return 0;

  // Proporção de tokens partilhados sobre o nome mais curto.
  const matched = tokensA.filter((tokenA) => tokensB.some((tokenB) => tokensMatch(tokenA, tokenB)));
  const shorter = Math.min(tokensA.length, tokensB.length);

  return matched.length / shorter;
}

/** Limiar a partir do qual vale a pena mostrar ao consultor. */
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.8;
