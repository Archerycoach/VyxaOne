/**
 * Importação de leads a partir de ficheiros de exportação de outros CRMs.
 *
 * Suporta dois formatos, detetados automaticamente pelas colunas:
 *
 * 1. "Leads" (MaxWork/RE/MAX) — uma linha por lead recebida de um portal.
 * 2. "Oportunidades" — uma linha por oportunidade comercial, com o contacto.
 *
 * Três armadilhas destes ficheiros, tratadas aqui:
 *
 * - No formato Leads, as colunas "Email"/"Telemóvel" são do AGENTE (repetem-se
 *   em todas as linhas). Os contactos da lead estão em "Email_1"/"Telemóvel_1".
 * - O formato Oportunidades vem paginado e REPETE a linha de cabeçalho no meio
 *   dos dados — essas linhas têm de ser descartadas.
 * - As datas vêm em dois formatos: número de série do Excel (Leads) e texto
 *   "DD/MM/AAAA HH:MM" (Oportunidades).
 */

export type ImportFormat = "leads_maxwork" | "oportunidades" | "desconhecido";

export interface ParsedLead {
  /** Linha no ficheiro (1-based, sem contar o cabeçalho) — para o relatório. */
  row: number;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  source: string | null;
  status: string | null;
  temperature: string | null;
  lead_type: string | null;
  property_type: string | null;
  bedrooms: number | null;
  budget: number | null;
  location_preference: string | null;
  notes: string | null;
  /** Identificador na origem, para não reimportar duas vezes o mesmo registo. */
  external_ref: string | null;
  /**
   * Histórico da oportunidade (chamadas, mudanças de estado, notas).
   *
   * A exportação de Oportunidades é hierárquica: cada oportunidade é seguida
   * das suas atividades. Importamo-las como interações da lead — é o histórico
   * de contactos, que de outra forma se perderia.
   */
  activities: Array<{
    date: string | null;
    user: string | null;
    description: string;
    /** Tipo da interação (call/email/whatsapp/meeting/visit). */
    type: string;
  }>;
}

/**
 * Só entram interações que sejam contacto REAL com o cliente.
 *
 * A exportação mistura contactos com ruído administrativo — mudanças de
 * estado, rodízios de responsável, transferências de unidade. Importar tudo
 * encheria o histórico da lead de eventos que não dizem nada ao consultor.
 *
 * Nos ficheiros analisados: 557 contactos reais em 3211 linhas de histórico.
 */
const REAL_CONTACT_PREFIX = "Uma atividade foi registada";

const ACTIVITY_TYPES: Array<{ match: RegExp; type: string }> = [
  { match: /^liga/i, type: "call" },
  { match: /^whatsapp/i, type: "whatsapp" },
  { match: /^email/i, type: "email" },
  { match: /^presencial|^reuni/i, type: "meeting" },
  { match: /^visita/i, type: "visit" },
];

export function isRealContactActivity(description: string): boolean {
  return description.trim().startsWith(REAL_CONTACT_PREFIX);
}

/**
 * Extrai o tipo e o texto útil de uma atividade.
 *
 * Formato de origem, tudo colado:
 *   "Uma atividade foi registada!Ligação para NOME Ligação no dia DD/MM/AAAA
 *    HH:MM com término em DD/MM/AAAA HH:MMnota escrita pelo consultor"
 *
 * O que interessa guardar é a nota final — o resto é repetição do que já
 * temos nos campos da interação.
 */
export function parseContactActivity(description: string): { type: string; content: string } {
  const body = description.replace(/^Uma atividade foi registada!?/i, "").trim();

  const typeEntry = ACTIVITY_TYPES.find((t) => t.match.test(body));
  const type = typeEntry?.type || "other";

  // Corta tudo até ao fim do bloco de datas; o que sobra é a nota real.
  const afterDates = body.split(/com término em \d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/i);
  const note = (afterDates.length > 1 ? afterDates[1] : "").trim();

  return {
    type,
    // Sem nota, guardamos o cabeçalho da atividade (ex.: "Ligação para X"),
    // que ainda diz ao consultor que houve contacto e de que tipo.
    content: note || body.split(/\s+no dia\s+/i)[0].trim() || body,
  };
}

export interface ParseResult {
  format: ImportFormat;
  leads: ParsedLead[];
  /** Linhas ignoradas e porquê — nunca descartamos em silêncio. */
  skipped: Array<{ row: number; reason: string }>;
}

// ---------------------------------------------------------------- utilidades

/** Excel guarda datas como dias desde 1899-12-30. */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "10/07/2026 11:02" → Date (formato português: dia primeiro). */
function parsePtDateTime(value: string): Date | null {
  const match = String(value)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;

  const [, d, m, y, hh, mm] = match;
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    hh ? Number(hh) : 0,
    mm ? Number(mm) : 0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Aceita os dois formatos e devolve ISO, ou null. */
export function parseAnyDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return excelSerialToDate(value)?.toISOString() || null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const pt = parsePtDateTime(value);
    if (pt) return pt.toISOString();
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
  }
  return null;
}

/** "€ 1.250,00" / "200000" → 200000 */
function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de milhares
    .replace(",", ".");

  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}

/**
 * Normaliza telefones portugueses. Números manifestamente inválidos são
 * descartados em vez de importados — é preferível um campo vazio a um
 * contacto errado que alguém vai tentar ligar.
 */
export function normalizePhone(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;

  const national = digits.startsWith("351") ? digits.slice(3) : digits;
  if (national.length !== 9) return raw; // estrangeiro: mantém como veio
  if (!/^[239]/.test(national)) return null; // não é fixo nem móvel PT

  return `+351${national}`;
}

function email(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower) ? lower : null;
}

/** Remove prefixos de empreendimento: "(VistaBella) Ana Ramalho" → "Ana Ramalho". */
function cleanContactName(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return raw.replace(/^\s*\([^)]*\)\s*/, "").trim() || raw;
}

// ------------------------------------------------------------- classificação

/** "Comprador" | "Proprietário" | "Arrendatário" → tipo de lead. */
function mapLeadType(profile: string | null, dealType: string | null): string | null {
  const p = (profile || "").toLowerCase();
  if (p.includes("proprietár")) return "seller";
  if (p.includes("comprador") || p.includes("arrendatár")) return "buyer";

  const d = (dealType || "").toLowerCase();
  if (d.includes("venda") || d.includes("arrenda")) return "buyer";
  return null;
}

/** "Morna" | "Fria" | "Quente" → temperatura do Vyxa. */
function mapTemperature(value: string | null): string | null {
  const v = (value || "").toLowerCase();
  if (v.startsWith("quen")) return "hot";
  if (v.startsWith("morn")) return "warm";
  if (v.startsWith("fri")) return "cold";
  return null;
}

/**
 * Fases de origem → fases do Vyxa.
 *
 * Devolve o identificador em português usado por defeito no pipeline. Quem
 * chama valida contra as fases realmente configuradas e, se não existir,
 * deixa a lead na fase inicial em vez de gravar um valor inválido.
 */
function mapStage(value: string | null): string | null {
  const v = (value || "").toLowerCase();
  if (!v) return null;

  // Formato Leads (MaxWork)
  if (v === "contacto") return "contactado";
  if (v === "qualificada") return "qualificado";
  if (v === "rodado") return "seguimento";
  if (v === "arquivado") return "perdido";

  // Formato Oportunidades (Etapa do Funil)
  if (v.includes("lead") || v.includes("prospe")) return "novo";
  if (v.includes("atendimento") || v.includes("triagem")) return "contactado";
  if (v.includes("qualificado")) return "qualificado";
  if (v.includes("visita")) return "visitas";
  if (v.includes("reunião") || v.includes("reuniao")) return "seguimento";
  if (v.includes("transa")) return "fechado";

  return null;
}

function mapPropertyType(value: string | null): string | null {
  const v = (value || "").toLowerCase();
  if (v.includes("apartamento")) return "apartment";
  if (v.includes("moradia")) return "house";
  if (v.includes("loja") || v.includes("comercial")) return "commercial";
  if (v.includes("terreno")) return "land";
  return null;
}

// ------------------------------------------------------------------ deteção

/**
 * Colunas que identificam cada formato.
 *
 * A deteção é por PONTUAÇÃO, não por correspondência exata: basta um número
 * mínimo de colunas conhecidas. Exigir nomes exatos fazia a importação falhar
 * com "formato não reconhecido" em exportações do mesmo CRM feitas por outro
 * utilizador — basta ter escolhido colunas diferentes, ou uma versão com
 * cabeçalhos ligeiramente distintos.
 */
const FORMAT_SIGNATURES: Array<{
  format: ImportFormat;
  columns: string[];
  minMatches: number;
}> = [
  {
    format: "leads_maxwork",
    columns: [
      "nome lead", "nome contacto", "data criacao no maxwork", "data criacao na origem",
      "estado", "origem", "telemovel_1", "email_1", "perfil de cliente",
      "tipo de negocio", "tipo de imovel", "complemento origem lead",
    ],
    minMatches: 3,
  },
  {
    format: "oportunidades",
    columns: [
      "nome da oportunidade", "nome de contacto", "email de contacto",
      "telemovel de contacto", "etapa do funil", "iniciado em", "temp.",
      "fonte", "canal", "interesse", "responsavel",
    ],
    minMatches: 3,
  },
];

/** Sem acentos, minúsculas, espaços normalizados — para comparar cabeçalhos. */
function canonHeader(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function detectFormat(columns: string[]): ImportFormat {
  const present = new Set(columns.map(canonHeader));

  let best: { format: ImportFormat; score: number } | null = null;

  for (const sig of FORMAT_SIGNATURES) {
    const score = sig.columns.filter((c) => present.has(c)).length;
    if (score >= sig.minMatches && (!best || score > best.score)) {
      best = { format: sig.format, score };
    }
  }

  return best?.format || "desconhecido";
}

/**
 * Encontra a linha do cabeçalho e devolve as linhas de dados.
 *
 * Algumas exportações trazem linhas de título, logótipo ou filtros antes do
 * cabeçalho verdadeiro. Nesse caso, ler a primeira linha como cabeçalho dá
 * colunas sem sentido ("__EMPTY_1") e a deteção falha. Percorremos as
 * primeiras linhas até encontrar uma que produza um formato reconhecível.
 */
export function readSheetRows(
  sheetToJson: (opts: { range?: number }) => Record<string, unknown>[]
): { rows: Record<string, unknown>[]; format: ImportFormat; headerRow: number } {
  const MAX_HEADER_SCAN = 8;

  for (let headerRow = 0; headerRow < MAX_HEADER_SCAN; headerRow++) {
    const rows = sheetToJson({ range: headerRow });
    if (rows.length === 0) continue;

    const format = detectFormat(Object.keys(rows[0]));
    if (format !== "desconhecido") {
      return { rows, format, headerRow };
    }
  }

  // Nenhuma linha produziu um formato conhecido: devolvemos a leitura normal,
  // para quem chama poder mostrar as colunas encontradas no erro.
  const rows = sheetToJson({});
  return { rows, format: "desconhecido", headerRow: 0 };
}

/**
 * A exportação de Oportunidades vem paginada e repete o cabeçalho no meio dos
 * dados. Essas linhas trazem o nome da coluna como valor ("Status" = "Status").
 */
function isRepeatedHeader(row: Record<string, unknown>): boolean {
  let matches = 0;
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && value.trim() === key.trim()) {
      matches++;
      if (matches >= 2) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------- parsers

export function parseRows(rows: Record<string, unknown>[]): ParseResult {
  if (rows.length === 0) {
    return { format: "desconhecido", leads: [], skipped: [] };
  }

  const format = detectFormat(Object.keys(rows[0]));

  if (format === "oportunidades") return parseOpportunitiesSheet(rows);
  if (format === "leads_maxwork") return parseMaxworkSheet(rows);

  return {
    format,
    leads: [],
    skipped: [{ row: 1, reason: "formato de ficheiro não reconhecido" }],
  };
}

/** Formato simples: uma linha por lead. */
function parseMaxworkSheet(rows: Record<string, unknown>[]): ParseResult {
  const leads: ParsedLead[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (isRepeatedHeader(row)) {
      skipped.push({ row: rowNumber, reason: "linha de cabeçalho repetida" });
      return;
    }

    const parsed = parseMaxworkRow(row, rowNumber);

    if (!parsed.name) {
      skipped.push({ row: rowNumber, reason: "sem nome" });
      return;
    }
    if (!parsed.email && !parsed.phone) {
      skipped.push({ row: rowNumber, reason: `sem contacto (${parsed.name})` });
      return;
    }

    leads.push(parsed);
  });

  return { format: "leads_maxwork", leads, skipped };
}

/**
 * Formato hierárquico: cada oportunidade é seguida do seu histórico.
 *
 *   [cabeçalho principal]
 *   Oportunidade X | contacto | email…      ← a oportunidade
 *   Data | Responsável | Descrição          ← sub-cabeçalho do histórico
 *   16/07/2026 11:33 | Consultor | Ligação… ← atividades
 *   ...
 *   [cabeçalho principal]                   ← recomeça
 *
 * Percorremos em sequência, guardando as atividades na oportunidade anterior.
 */
function parseOpportunitiesSheet(rows: Record<string, unknown>[]): ParseResult {
  const leads: ParsedLead[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  const columns = Object.keys(rows[0]);
  const [colA, colB, colC] = columns; // "Nome da oportunidade" | "Nome de contacto" | "Email de contacto"

  let current: ParsedLead | null = null;
  let inActivityBlock = false;

  const closeCurrent = () => {
    if (!current) return;
    if (!current.email && !current.phone) {
      skipped.push({ row: current.row, reason: `sem contacto (${current.name})` });
    } else {
      leads.push(current);
    }
    current = null;
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const a = row[colA] === null || row[colA] === undefined ? "" : String(row[colA]).trim();

    // Sub-cabeçalho do histórico: a partir daqui são atividades.
    if (a === "Data") {
      inActivityBlock = true;
      return;
    }

    // Cabeçalho principal repetido: fecha a oportunidade anterior.
    if (isRepeatedHeader(row)) {
      closeCurrent();
      inActivityBlock = false;
      return;
    }

    // Atividade: primeira coluna é uma data.
    if (inActivityBlock) {
      const when = parseAnyDate(a);
      const description = text(row[colC]);

      // Só contacto real com o cliente — o ruído administrativo (mudanças de
      // estado, rodízios, transferências) fica de fora.
      if (when && description && current && isRealContactActivity(description)) {
        const { type, content } = parseContactActivity(description);
        current.activities.push({
          date: when,
          user: text(row[colB]),
          description: content,
          type,
        });
      }
      return;
    }

    // Linha de oportunidade.
    closeCurrent();
    const parsed = parseOpportunityRow(row, rowNumber);
    if (!parsed.name) {
      skipped.push({ row: rowNumber, reason: "sem nome" });
      return;
    }
    current = parsed;
  });

  closeCurrent();

  return { format: "oportunidades", leads, skipped };
}

function parseMaxworkRow(row: Record<string, unknown>, rowNumber: number): ParsedLead {
  // ATENÇÃO: "Email"/"Telemóvel" são do AGENTE. Os da lead são "Email_1"/"Telemóvel_1".
  const notes = [
    text(row["Comentários"]),
    text(row["Imóvel"]) ? `Imóvel de origem: ${text(row["Imóvel"])}` : null,
    text(row["Complemento Origem Lead"]),
  ]
    .filter(Boolean)
    .join("\n\n");

  const location = [text(row["Freguesia"]), text(row["Concelho"]), text(row["Distrito"])]
    .filter(Boolean)
    .join(", ");

  return {
    row: rowNumber,
    name: cleanContactName(row["Nome Lead"] || row["Nome Contacto"]) || "",
    email: email(row["Email_1"]),
    phone: normalizePhone(row["Telemóvel_1"]),
    // "Data criação na Origem" vem vazia nestes ficheiros; a real é a do Maxwork.
    created_at: parseAnyDate(row["Data criação na Origem"] ?? null) || parseAnyDate(row["Data criação no Maxwork"]),
    source: text(row["Origem"]) || text(row["Origem Contacto"]),
    status: mapStage(text(row["Estado"])),
    temperature: null,
    lead_type: mapLeadType(text(row["Perfil de Cliente"]), text(row["Tipo de Negócio"])),
    property_type: mapPropertyType(text(row["Tipo de Imóvel"])),
    bedrooms: Number.isFinite(Number(row["Nº de Quartos"])) ? Number(row["Nº de Quartos"]) : null,
    budget: parseMoney(row["Preço"]),
    location_preference: location || null,
    notes: notes || null,
    external_ref: text(row["Id"]),
    activities: [],
  };
}

function parseOpportunityRow(row: Record<string, unknown>, rowNumber: number): ParsedLead {
  const notes = [
    text(row["Nome da oportunidade"]),
    text(row["Interesse"]) ? `Interesse: ${text(row["Interesse"])}` : null,
    text(row["Produto"]) ? `Empreendimento: ${text(row["Produto"])}` : null,
    text(row["Unidade"]) ? `Unidade: ${text(row["Unidade"])}` : null,
    text(row["Canal"]) ? `Canal: ${text(row["Canal"])}` : null,
    text(row["Ocupação de contacto"]) ? `Ocupação: ${text(row["Ocupação de contacto"])}` : null,
    text(row["Etiqueta"]),
  ]
    .filter(Boolean)
    .join("\n");

  const location = [text(row["Locais de interesse"]), text(row["Concelho do contacto"]), text(row["Distrito do contacto"])]
    .filter(Boolean)
    .join(", ");

  return {
    row: rowNumber,
    name: cleanContactName(row["Nome de contacto"]) || "",
    email: email(row["Email de contacto"]),
    phone: normalizePhone(row["Telemóvel de contacto"]),
    created_at: parseAnyDate(row["Iniciado em"]),
    source: text(row["Fonte"]),
    status: mapStage(text(row["Etapa do Funil"])),
    temperature: mapTemperature(text(row["Temp."])),
    lead_type: "buyer",
    property_type: mapPropertyType(text(row["Interesse"])),
    bedrooms: null,
    budget: parseMoney(row["Investimento"]),
    location_preference: location || null,
    notes: notes || null,
    external_ref: text(row["CÓD."]),
    activities: [],
  };
}
