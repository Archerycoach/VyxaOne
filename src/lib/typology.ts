/**
 * Tipologias procuradas por uma lead.
 *
 * O campo `typology` é texto e pode conter mais do que uma tipologia,
 * separadas por vírgula ("T1, T2"). O sufixo "+" marca um mínimo aberto:
 * "T2+" significa "T2 ou superior" — quem procura no mínimo um T2 aceita um
 * T3 ou T4, desde que o preço caiba no orçamento.
 *
 * Vive num módulo neutro (não em lib/server) porque tanto o cruzamento no
 * servidor como a pesquisa do Idealista no cliente precisam das mesmas regras.
 */

/** Extrai o nº de quartos de uma tipologia PT ("T2", "t3 duplex" → 2, 3). */
export function typologyToBedrooms(typology: string | null | undefined): number | null {
  const match = /t\s*(\d+)/i.exec(typology || "");
  return match ? Number(match[1]) : null;
}

/** "T1, T2+" → ["T1", "T2+"] */
export function parseTypologyList(typology: string | null | undefined): string[] {
  return String(typology || "")
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Todos os nºs de quartos listados (ignora o "+"). */
export function typologyBedroomsList(typology: string | null | undefined): number[] {
  const values = parseTypologyList(typology)
    .map((part) => typologyToBedrooms(part))
    .filter((value): value is number => value != null);
  return Array.from(new Set(values));
}

/** Esta tipologia serve para a lead? O orçamento é verificado à parte. */
export function typologyAcceptsBedrooms(
  typology: string | null | undefined,
  bedrooms: number | null | undefined
): boolean {
  if (bedrooms == null) return false;

  return parseTypologyList(typology).some((entry) => {
    const entryBedrooms = typologyToBedrooms(entry);
    if (entryBedrooms == null) return false;
    return entry.includes("+") ? bedrooms >= entryBedrooms : bedrooms === entryBedrooms;
  });
}

/** A lead aceita tipologias acima da maior listada? */
export function isOpenEndedTypology(typology: string | null | undefined): boolean {
  return parseTypologyList(typology).some((entry) => entry.includes("+"));
}
