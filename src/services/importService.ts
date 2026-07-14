import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";

// Export types
export type ImportResult = {
  success: number;
  errors: any[];
  total?: number;
  warnings?: string[];
};

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type PropertyInsert = Database["public"]["Tables"]["properties"]["Insert"];

export const parseExcelFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

// Parse date from Excel (handles DD/MM/YYYY, YYYY-MM-DD, or Excel serial number)
const parseDate = (value: any): string | null => {
  if (!value) return null;
  
  // If it's already a valid ISO string
  if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toISOString();
  }
  
  // If it's a string date (DD/MM/YYYY)
  if (typeof value === "string" && value.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const [day, month, year] = value.split("/");
    return new Date(`${year}-${month}-${day}`).toISOString();
  }
  
  // If it's an Excel serial number
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString();
  }
  
  // Try to parse as Date
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return null;
};

// Parse budget (handles currency symbols, labels like "Até", and separators)
const parseBudget = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;

  // Mantém só dígitos e separadores (remove "Até", "€", espaços, etc.)
  let s = String(value).replace(/[^0-9.,]/g, "");
  if (!s) return null;
  s = s.replace(/\./g, "").replace(/,/g, "."); // milhares "." fora; decimal "," -> "."
  const number = parseFloat(s);
  if (isNaN(number)) return null;
  // A coluna budget é DECIMAL(12,2) — máx ~9.999.999.999,99. Valores acima
  // disso são quase de certeza intervalos colados (ex.: "400000600000" =
  // 400.000–600.000 €) ou lixo. Não adivinhamos: devolvemos null (a lead
  // importa na mesma, sem orçamento) para evitar "numeric field overflow".
  if (number > 9_999_999_999) return null;
  return number;
};

// Normaliza um telefone para "+" opcional seguido só de dígitos
// (ex.: "+351 914 700 599" -> "+351914700599"). Removemos espaços, hífens e
// parênteses de propósito: a constraint da BD em produção só aceita dígitos,
// por isso este formato canónico é sempre aceite. Devolve null quando o valor
// é ambíguo ou irreparável — nunca inventamos um número (um número errado num
// CRM é pior que nenhum). Retorna { value, dropped } para avisar o utilizador.
const sanitizePhone = (value: any): { value: string | null; dropped: boolean } => {
  if (value === null || value === undefined) return { value: null, dropped: false };
  const original = String(value).trim();
  if (!original) return { value: null, dropped: false };

  const plusCount = (original.match(/\+/g) || []).length;
  const hasPlus = original.trimStart().startsWith("+");
  const digits = original.replace(/[^0-9]/g, "");

  // Vários "+" = vários números colados → ambíguo, não adivinhamos.
  // Fora de 9–20 dígitos → curto/irreparável ou vários números juntos.
  if (plusCount > 1 || digits.length < 9 || digits.length > 20) {
    return { value: null, dropped: true };
  }
  return { value: (hasPlus ? "+" : "") + digits, dropped: false };
};

// Valida o email contra a constraint da BD; se não for válido, devolve null
// (importa a lead na mesma, sem email).
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const sanitizeEmail = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s && EMAIL_RE.test(s) ? s : null;
};

// Inteiro (área, quartos…) tolerante a texto ("120 m²" -> 120).
const parseIntOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return isNaN(n) ? null : n;
};

// "sim/não", "s/n", "true/false", "1/0" -> boolean (ou null se vazio).
const parseBool = (value: any): boolean | null => {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).toLowerCase().trim();
  if (["sim", "s", "true", "verdadeiro", "1", "yes", "y"].includes(s)) return true;
  if (["não", "nao", "n", "false", "falso", "0", "no"].includes(s)) return false;
  return null;
};

const normalizePropertyType = (value: any): string | null => {
  if (!value) return null;
  const s = String(value).toLowerCase().trim();
  if (s.includes("aparta") || s === "apartment") return "apartment";
  if (s.includes("moradia") || s.includes("casa") || s === "house") return "house";
  if (s.includes("terreno") || s === "land") return "land";
  if (s.includes("loja") || s === "store") return "store";
  if (s.includes("escrit") || s === "office") return "office";
  if (s.includes("armaz") || s === "warehouse") return "warehouse";
  if (s.includes("comerc") || s === "commercial") return "commercial";
  return null;
};

const normalizeTemperature = (value: any): string | null => {
  if (!value) return null;
  const s = String(value).toLowerCase().trim();
  if (s.includes("quente") || s === "hot") return "hot";
  if (s.includes("morno") || s.includes("morna") || s === "warm") return "warm";
  if (s.includes("frio") || s.includes("fria") || s === "cold") return "cold";
  return null;
};

// Normaliza um cabeçalho: minúsculas, sem acentos, sem parênteses de ajuda
// ("Tipo (comprador/vendedor)" -> "tipo", "Área mínima (m²)" -> "area minima").
const canonKey = (k: string): string =>
  String(k)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Devolve um acessor que encontra o valor de uma coluna por qualquer um dos
// seus nomes possíveis, tolerante a acentos/maiúsculas/textos de ajuda entre
// parênteses. Assim a importação funciona tanto com o nosso template como com
// ficheiros de outros CRMs.
const makeRowAccessor = (row: any) => {
  const byCanon: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    byCanon[canonKey(key)] = row[key];
  }
  return (...aliases: string[]): any => {
    for (const alias of aliases) {
      const v = byCanon[canonKey(alias)];
      if (v !== undefined) return v;
    }
    return undefined;
  };
};

// Normalize lead type
const normalizeLeadType = (value: any): "buyer" | "seller" | "both" => {
  if (!value) return "buyer";
  
  const normalized = String(value).toLowerCase().trim();
  
  if (normalized.includes("comprador") || normalized === "buyer") return "buyer";
  if (normalized.includes("vendedor") || normalized === "seller") return "seller";
  if (normalized.includes("ambos") || normalized === "both") return "both";
  
  return "buyer";
};

// Normaliza o "Estado" importado para um id de fase do pipeline de comprador
// (as fases por defeito: new, qualified, visit, proposal, negotiation, closed).
// Assim a lead importada entra na coluna certa e o estado corresponde à fase.
// "won"/"lost" não têm coluna própria mas mantêm-se como rótulo reconhecível.
const normalizeStatus = (value: any): string => {
  if (!value) return "new";

  const normalized = String(value).toLowerCase().trim();

  if (normalized.includes("nova") || normalized.includes("novo") || normalized.includes("pendente") || normalized === "new") return "new";
  if (normalized.includes("qualificad") || normalized === "qualified") return "qualified";
  if (normalized.includes("visita") || normalized === "visit") return "visit";
  if (normalized.includes("proposta") || normalized === "proposal") return "proposal";
  if (normalized.includes("negocia") || normalized === "negotiation") return "negotiation";
  if (normalized.includes("fechado") || normalized.includes("ganho") || normalized === "won" || normalized === "closed") return "closed";
  if (normalized.includes("perdido") || normalized === "lost") return "lost";
  // "Em progresso"/"Contactado"/"Pausado" → lead já em trabalho ativo
  if (normalized.includes("progresso") || normalized.includes("contact") || normalized.includes("pausado")) return "qualified";

  return "new";
};

export const importLeads = async (data: any[]): Promise<ImportResult> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const leadsToInsert: LeadInsert[] = [];
  const errors: any[] = [];
  const warnings: string[] = [];

  // As leads importadas são dados migrados/antigos: devem aparecer no FIM da
  // lista (ordenada por created_at desc). Ancoramos o created_at delas
  // imediatamente antes da lead mais antiga já existente deste utilizador —
  // datas realistas (não um ano fictício) e a ordem do ficheiro é preservada.
  const { data: oldestLead } = await supabase
    .from("leads")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const anchorMs = (oldestLead as any)?.created_at
    ? new Date((oldestLead as any).created_at).getTime()
    : Date.now();

  data.forEach((row, idx) => {
    const line = idx + 2; // +1 cabeçalho, +1 para base 1
    try {
      const get = makeRowAccessor(row);

      const rawPhone = get("phone", "telefone", "telemovel", "contacto") ?? null;
      const { value: phone, dropped } = sanitizePhone(rawPhone);
      if (dropped) {
        warnings.push(`Linha ${line}: telefone "${String(rawPhone).trim()}" inválido — lead importada sem telefone.`);
      }

      const rawTypology = get("typology", "tipologia");
      const typology = rawTypology ? String(rawTypology).trim().toUpperCase() : null;

      const rawLocation = get("location_preference", "localizacao", "localizacao pretendida", "zona");
      const rawSource = get("source", "fonte", "origem");
      const rawTimeline = get("purchase_timeline", "prazo de compra", "prazo");

      const lead: LeadInsert = {
        user_id: user.id,
        // Sem assigned_to a lead não passa o filtro de visibilidade do getLeads
        // (assigned_to.in.(...)) e não apareceria na aplicação após importar.
        assigned_to: user.id,
        name: get("name", "nome") || "Sem Nome",
        email: sanitizeEmail(get("email")),
        phone,
        source: rawSource ? String(rawSource).trim() : null,
        budget: parseBudget(get("budget", "orcamento")),
        budget_min: parseBudget(get("budget_min", "orcamento minimo")),
        budget_max: parseBudget(get("budget_max", "orcamento maximo")),
        location_preference: rawLocation ? String(rawLocation).trim() : null,
        property_type: normalizePropertyType(get("property_type", "tipo de imovel")),
        typology,
        bedrooms: typology ? parseIntOrNull(typology) : parseIntOrNull(get("bedrooms", "quartos")),
        min_area: parseIntOrNull(get("min_area", "area minima")),
        max_area: parseIntOrNull(get("max_area", "area maxima")),
        purchase_timeline: rawTimeline ? String(rawTimeline).trim() : null,
        needs_financing: parseBool(get("needs_financing", "precisa de financiamento", "financiamento")),
        has_property_to_sell: parseBool(get("has_property_to_sell", "tem imovel para vender")),
        temperature: normalizeTemperature(get("temperature", "temperatura")),
        birthday: parseDate(get("birthday", "aniversario", "data de nascimento")),
        notes: get("notes", "notas", "observacoes") || null,
      } as LeadInsert;

      // Se havia orçamento mas não deu para o converter (ex.: intervalo colado
      // como "400000600000"), avisa — a lead entra na mesma, sem orçamento.
      const rawBudget = get("budget", "orcamento");
      if (rawBudget != null && String(rawBudget).trim() !== "" && lead.budget == null) {
        warnings.push(`Linha ${line}: orçamento "${String(rawBudget).trim()}" inválido — lead importada sem orçamento.`);
      }

      // Estado da lead = fase do pipeline. Mantém status e buyer_status/
      // seller_status coerentes para a lead aparecer na coluna certa.
      const leadType = normalizeLeadType(get("lead_type", "tipo"));
      const stage = normalizeStatus(get("status", "fase", "estado"));
      lead.lead_type = leadType;
      lead.status = stage;
      if (leadType === "seller") {
        (lead as any).seller_status = stage;
      } else {
        (lead as any).buyer_status = stage;
      }

      if (!lead.name) {
        throw new Error("Nome é obrigatório");
      }

      // created_at antigo (antes da lead mais antiga existente), mantendo a
      // ordem do ficheiro: a primeira linha fica a mais antiga de todas.
      const createdAt = new Date(anchorMs - (data.length - idx) * 1000).toISOString();
      (lead as any).created_at = createdAt;
      // Leads migradas: primeiro contacto tido como já feito, para não
      // dispararem os alertas de "primeiro contacto em falta".
      (lead as any).first_contact_at = createdAt;

      leadsToInsert.push(lead as any);
    } catch (error: any) {
      errors.push({ line, error: error.message });
    }
  });

  // Insere em blocos; se um bloco falhar (constraint inesperada), reprocessa
  // linha-a-linha para isolar a(s) linha(s) problemática(s) sem perder o resto.
  let success = 0;
  const CHUNK = 100;
  for (let i = 0; i < leadsToInsert.length; i += CHUNK) {
    const chunk = leadsToInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("leads").insert(chunk);
    if (!error) {
      success += chunk.length;
      continue;
    }
    for (const lead of chunk) {
      const { error: rowError } = await supabase.from("leads").insert(lead);
      if (rowError) {
        errors.push({ line: `(${(lead as any).name})`, error: rowError.message });
      } else {
        success++;
      }
    }
  }

  return { success, errors, total: data.length, warnings };
};

export const importProperties = async (data: any[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const propertiesToInsert: PropertyInsert[] = [];
  const errors: any[] = [];

  for (const row of data) {
    try {
      const property: PropertyInsert = {
        title: row.title || `Imóvel - ${new Date().toLocaleDateString()}`,
        description: row.description || "",
        address: row.address || "",
        city: row.city || "",
        postal_code: row.postal_code || "",
        price: row.price ? Number(row.price) : 0,
        area: row.area ? Number(row.area) : 0,
        bathrooms: row.bathrooms ? Number(row.bathrooms) : 0,
        bedrooms: row.bedrooms ? Number(row.bedrooms) : 0,
        status: "available",
        property_type: (row.property_type || "apartment") as any,
        user_id: user.id
      };

      if (!property.title) throw new Error("Título é obrigatório");

      propertiesToInsert.push(property);
    } catch (error: any) {
      errors.push({ row, error: error.message });
    }
  }

  if (propertiesToInsert.length > 0) {
    const { error } = await supabase.from("properties").insert(propertiesToInsert);
    if (error) throw error;
  }

  return { success: propertiesToInsert.length, errors };
};

// Aliases for backward compatibility
export const importLeadsFromExcel = importLeads;

// Template Generators
export const generateLeadsTemplate = () => {
  // Cabeçalhos alinhados com o detalhe atual das leads e com o que a
  // importação sabe mapear. Só "Nome" é obrigatório; o resto é opcional.
  const headers = [
    "Nome",
    "Email",
    "Telefone",
    "Tipo (comprador/vendedor/ambos)",
    "Fase (Nova Lead/Qualificada/Visita/Proposta/Negociação/Fechado)",
    "Fonte",
    "Orçamento mínimo (€)",
    "Orçamento máximo (€)",
    "Localização pretendida",
    "Tipo de imóvel (apartamento/moradia/terreno/comercial/loja/escritório/armazém)",
    "Tipologia (T0-T5+)",
    "Área mínima (m²)",
    "Área máxima (m²)",
    "Prazo de compra",
    "Precisa de financiamento (sim/não)",
    "Tem imóvel para vender (sim/não)",
    "Temperatura (quente/morno/frio)",
    "Aniversário (AAAA-MM-DD)",
    "Notas",
  ];
  // Linha de exemplo para orientar o preenchimento.
  const example = [
    "Maria Silva",
    "maria.silva@email.com",
    "+351912345678",
    "comprador",
    "Qualificada",
    "Site",
    "250000",
    "350000",
    "Lisboa, Alvalade",
    "apartamento",
    "T2",
    "80",
    "120",
    "3 meses",
    "sim",
    "não",
    "morno",
    "1985-04-23",
    "Prefere andar alto, com varanda.",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.min(Math.max(h.length, 14), 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Leads");
  XLSX.writeFile(wb, "template_leads_vyxaone.xlsx");
};

export const generatePropertiesTemplate = () => {
  const headers = [
    "Titulo", "Descricao", "Preco", "Tipo", "Estado", 
    "Area", "Quartos", "Casas de Banho", "Morada", "Cidade"
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Imoveis");
  XLSX.writeFile(wb, "template_imoveis_vyxaone.xlsx");
};