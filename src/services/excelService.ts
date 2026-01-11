import * as XLSX from "xlsx";
import type { Lead } from "@/types";

/**
 * Excel Service
 * Handles Excel file generation for lead data export and import templates
 */

// Complete list of all lead fields for import/export
const LEAD_FIELDS = {
  // Basic Information
  name: "Nome *",
  email: "Email",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  lead_type: "Tipo * (buyer/seller/both)",
  status: "Status * (new/contacted/qualified/negotiating/won/lost)",
  
  // Additional Information
  source: "Origem",
  location_preference: "Localização Preferida",
  budget: "Orçamento",
  temperature: "Temperatura (cold/warm/hot)",
  notes: "Notas",
  assigned_to: "Atribuído a (ID do Agente)",
  birthday: "Data de Aniversário (YYYY-MM-DD)",
  
  // Buyer Specific Fields
  buyer_purpose: "Propósito Comprador (primary_residence/investment/vacation_home/other)",
  buyer_property_type: "Tipo Imóvel Comprador (apartment/house/land/commercial/other)",
  buyer_typology: "Tipologia Comprador (T0/T1/T2/T3/T4/T5+)",
  buyer_needs_financing: "Precisa Financiamento (true/false)",
  buyer_will_sell_to_buy: "Vai Vender para Comprar (true/false)",
  
  // Seller Specific Fields
  seller_property_type: "Tipo Imóvel Vendedor (apartment/house/land/commercial/other)",
  seller_typology: "Tipologia Vendedor (T0/T1/T2/T3/T4/T5+)",
  seller_location: "Localização Imóvel Vendedor"
};

// Example data for template
const TEMPLATE_EXAMPLE_DATA = [
  {
    "Nome *": "João Silva",
    "Email": "joao.silva@email.com",
    "Telefone": "+351 912 345 678",
    "WhatsApp": "+351 912 345 678",
    "Tipo * (buyer/seller/both)": "buyer",
    "Status * (new/contacted/qualified/negotiating/won/lost)": "new",
    "Origem": "Website",
    "Localização Preferida": "Lisboa",
    "Orçamento": "250000",
    "Temperatura (cold/warm/hot)": "hot",
    "Notas": "Interessado em apartamento T2",
    "Atribuído a (ID do Agente)": "",
    "Data de Aniversário (YYYY-MM-DD)": "1990-03-15",
    "Propósito Comprador (primary_residence/investment/vacation_home/other)": "primary_residence",
    "Tipo Imóvel Comprador (apartment/house/land/commercial/other)": "apartment",
    "Tipologia Comprador (T0/T1/T2/T3/T4/T5+)": "T2",
    "Precisa Financiamento (true/false)": "true",
    "Vai Vender para Comprar (true/false)": "false",
    "Tipo Imóvel Vendedor (apartment/house/land/commercial/other)": "",
    "Tipologia Vendedor (T0/T1/T2/T3/T4/T5+)": "",
    "Localização Imóvel Vendedor": ""
  },
  {
    "Nome *": "Maria Santos",
    "Email": "maria.santos@email.com",
    "Telefone": "+351 918 765 432",
    "WhatsApp": "+351 918 765 432",
    "Tipo * (buyer/seller/both)": "seller",
    "Status * (new/contacted/qualified/negotiating/won/lost)": "contacted",
    "Origem": "Referência",
    "Localização Preferida": "Porto",
    "Orçamento": "",
    "Temperatura (cold/warm/hot)": "warm",
    "Notas": "Quer vender apartamento T3",
    "Atribuído a (ID do Agente)": "",
    "Data de Aniversário (YYYY-MM-DD)": "1985-07-22",
    "Propósito Comprador (primary_residence/investment/vacation_home/other)": "",
    "Tipo Imóvel Comprador (apartment/house/land/commercial/other)": "",
    "Tipologia Comprador (T0/T1/T2/T3/T4/T5+)": "",
    "Precisa Financiamento (true/false)": "",
    "Vai Vender para Comprar (true/false)": "",
    "Tipo Imóvel Vendedor (apartment/house/land/commercial/other)": "apartment",
    "Tipologia Vendedor (T0/T1/T2/T3/T4/T5+)": "T3",
    "Localização Imóvel Vendedor": "Porto Centro"
  },
  {
    "Nome *": "Pedro Costa",
    "Email": "pedro.costa@email.com",
    "Telefone": "+351 915 123 456",
    "WhatsApp": "+351 915 123 456",
    "Tipo * (buyer/seller/both)": "both",
    "Status * (new/contacted/qualified/negotiating/won/lost)": "qualified",
    "Origem": "Facebook",
    "Localização Preferida": "Cascais",
    "Orçamento": "400000",
    "Temperatura (cold/warm/hot)": "hot",
    "Notas": "Quer vender T2 e comprar T3",
    "Atribuído a (ID do Agente)": "",
    "Data de Aniversário (YYYY-MM-DD)": "1988-11-30",
    "Propósito Comprador (primary_residence/investment/vacation_home/other)": "primary_residence",
    "Tipo Imóvel Comprador (apartment/house/land/commercial/other)": "apartment",
    "Tipologia Comprador (T0/T1/T2/T3/T4/T5+)": "T3",
    "Precisa Financiamento (true/false)": "true",
    "Vai Vender para Comprar (true/false)": "true",
    "Tipo Imóvel Vendedor (apartment/house/land/commercial/other)": "apartment",
    "Tipologia Vendedor (T0/T1/T2/T3/T4/T5+)": "T2",
    "Localização Imóvel Vendedor": "Lisboa"
  }
];

/**
 * Generate Excel template for lead import
 * Includes all fields with example data
 */
export const generateLeadImportTemplate = (): void => {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Create worksheet with example data
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLE_DATA);
  
  // Set column widths
  const columnWidths = Object.keys(TEMPLATE_EXAMPLE_DATA[0]).map(() => ({ wch: 25 }));
  ws['!cols'] = columnWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  
  // Create instructions sheet
  const instructions = [
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "1. Preencha os dados nas colunas correspondentes" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "2. Campos obrigatórios marcados com * devem ser preenchidos" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "3. Mantenha os cabeçalhos exatamente como estão" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TIPOS DE LEAD:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- buyer: Comprador" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- seller: Vendedor" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- both: Comprador e Vendedor" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "STATUS DISPONÍVEIS:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- new: Novo" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- contacted: Contactado" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- qualified: Qualificado" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- negotiating: Em Negociação" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- won: Ganho" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- lost: Perdido" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TEMPERATURA:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- cold: Frio (pouco interesse)" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- warm: Morno (interesse moderado)" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- hot: Quente (muito interessado)" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "PROPÓSITO COMPRADOR:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- primary_residence: Habitação Própria" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- investment: Investimento" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- vacation_home: Casa de Férias" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- other: Outro" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TIPO DE IMÓVEL:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- apartment: Apartamento" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- house: Moradia" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- land: Terreno" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- commercial: Comercial" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- other: Outro" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TIPOLOGIA:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- T0, T1, T2, T3, T4, T5+" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "FORMATO DE DATA:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- Aniversário: YYYY-MM-DD (ex: 1990-03-15)" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "VALORES BOOLEANOS:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- true ou false (minúsculas)" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "CAMPOS ESPECÍFICOS:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- Preencha campos de COMPRADOR se Tipo = buyer ou both" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- Preencha campos de VENDEDOR se Tipo = seller ou both" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- Deixe em branco os campos não aplicáveis" }
  ];
  
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");
  
  // Generate and download file
  XLSX.writeFile(wb, `template_importacao_leads_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Export leads to Excel file
 */
export const exportLeadsToExcel = (leads: any[]): void => {
  if (leads.length === 0) {
    alert("Não há leads para exportar");
    return;
  }
  
  // Map leads to export format with all fields (handling both camelCase and snake_case)
  const exportData = leads.map(lead => ({
    "Nome *": lead.name,
    "Email": lead.email || "",
    "Telefone": lead.phone || "",
    "WhatsApp": lead.whatsapp || "",
    "Tipo * (buyer/seller/both)": lead.lead_type || lead.type || "",
    "Status * (new/contacted/qualified/negotiating/won/lost)": lead.status,
    "Origem": lead.source || "",
    "Localização Preferida": lead.location_preference || lead.preferences?.location || "",
    "Orçamento": lead.budget || "",
    "Temperatura (cold/warm/hot)": lead.temperature || "",
    "Notas": lead.notes || "",
    "Atribuído a (ID do Agente)": lead.assigned_to || lead.assignedTo || "",
    "Data de Aniversário (YYYY-MM-DD)": lead.birthday || "",
    "Propósito Comprador": lead.buyer_purpose || lead.buyerPurpose || "",
    "Tipo Imóvel Comprador": lead.buyer_property_type || lead.buyerPropertyType || "",
    "Tipologia Comprador": lead.buyer_typology || lead.buyerTypology || "",
    "Precisa Financiamento": (lead.buyer_needs_financing !== null && lead.buyer_needs_financing !== undefined) ? String(lead.buyer_needs_financing) : (lead.buyerNeedsFinancing !== null && lead.buyerNeedsFinancing !== undefined ? String(lead.buyerNeedsFinancing) : ""),
    "Vai Vender para Comprar": (lead.buyer_will_sell_to_buy !== null && lead.buyer_will_sell_to_buy !== undefined) ? String(lead.buyer_will_sell_to_buy) : (lead.buyerWillSellToBuy !== null && lead.buyerWillSellToBuy !== undefined ? String(lead.buyerWillSellToBuy) : ""),
    "Tipo Imóvel Vendedor": lead.seller_property_type || lead.sellerPropertyType || "",
    "Tipologia Vendedor": lead.seller_typology || lead.sellerTypology || "",
    "Localização Imóvel Vendedor": lead.seller_location || lead.sellerLocation || "",
    "Criado em": new Date(lead.created_at || lead.createdAt).toLocaleString('pt-PT')
  }));
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths
  const columnWidths = Object.keys(exportData[0]).map(() => ({ wch: 25 }));
  ws['!cols'] = columnWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  
  // Generate and download file
  XLSX.writeFile(wb, `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Alias for compatibility
export const generateLeadsTemplate = generateLeadImportTemplate;

/**
 * Export properties to Excel file
 */
export const exportPropertiesToExcel = (properties: any[], filename: string = "properties.xlsx"): void => {
  if (properties.length === 0) {
    alert("Não há imóveis para exportar");
    return;
  }
  
  const exportData = properties.map(property => ({
    "Título": property.title,
    "Tipo": property.type,
    "Status": property.status,
    "Preço": property.price,
    "Área": property.area,
    "Quartos": property.bedrooms || "",
    "Casas de Banho": property.bathrooms || "",
    "Cidade": property.city,
    "Morada": property.address || "",
    "Criado em": new Date(property.created_at).toLocaleString('pt-PT')
  }));
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  const columnWidths = Object.keys(exportData[0]).map(() => ({ wch: 20 }));
  ws['!cols'] = columnWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Imóveis");
  XLSX.writeFile(wb, filename);
};

/**
 * Generate properties import template
 */
export const generatePropertiesTemplate = (): void => {
  const templateData = [{
    "Título": "Apartamento T2 Moderno",
    "Tipo": "apartment",
    "Status": "available",
    "Preço": "250000",
    "Área": "85",
    "Quartos": "2",
    "Casas de Banho": "2",
    "Cidade": "Lisboa",
    "Morada": "Avenida da Liberdade"
  }];
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateData);
  const columnWidths = Object.keys(templateData[0]).map(() => ({ wch: 25 }));
  ws['!cols'] = columnWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Imóveis");
  XLSX.writeFile(wb, `template_importacao_imoveis_${new Date().toISOString().split('T')[0]}.xlsx`);
};