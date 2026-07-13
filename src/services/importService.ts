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
  return isNaN(number) ? null : number;
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

// Normalize lead type
const normalizeLeadType = (value: any): "buyer" | "seller" | "both" => {
  if (!value) return "buyer";
  
  const normalized = String(value).toLowerCase().trim();
  
  if (normalized.includes("comprador") || normalized === "buyer") return "buyer";
  if (normalized.includes("vendedor") || normalized === "seller") return "seller";
  if (normalized.includes("ambos") || normalized === "both") return "both";
  
  return "buyer";
};

// Normalize status
const normalizeStatus = (value: any): "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost" => {
  if (!value) return "new";
  
  const normalized = String(value).toLowerCase().trim();
  
  if (normalized.includes("novo") || normalized === "new") return "new";
  if (normalized.includes("contactado") || normalized === "contacted") return "contacted";
  if (normalized.includes("qualificado") || normalized === "qualified") return "qualified";
  if (normalized.includes("proposta") || normalized === "proposal") return "proposal";
  if (normalized.includes("negociação") || normalized === "negotiation") return "negotiation";
  if (normalized.includes("ganho") || normalized === "won") return "won";
  if (normalized.includes("perdido") || normalized === "lost") return "lost";
  // Estados comuns exportados de outros CRMs
  if (normalized.includes("progresso") || normalized.includes("pausado")) return "contacted";

  return "new";
};

export const importLeads = async (data: any[]): Promise<ImportResult> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const leadsToInsert: LeadInsert[] = [];
  const errors: any[] = [];
  const warnings: string[] = [];

  data.forEach((row, idx) => {
    const line = idx + 2; // +1 cabeçalho, +1 para base 1
    try {
      const rawPhone = row.phone ?? row.Telefone ?? null;
      const { value: phone, dropped } = sanitizePhone(rawPhone);
      if (dropped) {
        warnings.push(`Linha ${line}: telefone "${String(rawPhone).trim()}" inválido — lead importada sem telefone.`);
      }

      const lead: LeadInsert = {
        user_id: user.id,
        // Sem assigned_to a lead não passa o filtro de visibilidade do getLeads
        // (assigned_to.in.(...)) e não apareceria na aplicação após importar.
        assigned_to: user.id,
        name: row.name || row.Nome || "Sem Nome",
        email: sanitizeEmail(row.email ?? row.Email),
        phone,
        notes: row.notes || row.Notas || null,
        lead_type: normalizeLeadType(
          row.lead_type ?? row.Tipo ?? row["Tipo (comprador/vendedor)"]
        ),
        status: normalizeStatus(row.status ?? row.Estado),
        budget: parseBudget(row.budget ?? row.Orcamento ?? row["Orçamento"]),
      } as LeadInsert;

      if (!lead.name) {
        throw new Error("Nome é obrigatório");
      }

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
  const headers = [
    "Nome", "Email", "Telefone", "Tipo (comprador/vendedor)", 
    "Estado", "Orcamento", "Localizacao", "Notas"
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
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