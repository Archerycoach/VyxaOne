import * as XLSX from "xlsx";
import type { Lead } from "@/types";

/**
 * Excel Service
 * Handles Excel file generation for lead data export and import templates
 */

// Colunas do template de importação genérico.
//
// IMPORTANTE: cada cabeçalho corresponde a UM campo que o importador
// (importService.importLeads → makeRowAccessor/canonKey) sabe ler. O texto entre
// parênteses é ignorado na leitura (só serve de ajuda). NÃO acrescentar colunas
// que o importador não mapeia — davam a falsa ideia de serem importadas (era o
// problema do template antigo, com campos comprador/vendedor que se perdiam).
const TEMPLATE_EXAMPLE_DATA = [
  {
    "Nome *": "João Silva",
    "Email": "joao.silva@email.com",
    "Telefone": "+351 912 345 678",
    "Tipo * (buyer/seller/both)": "buyer",
    "Estado * (new/qualified/visit/proposal/negotiation/won/lost)": "new",
    "Temperatura (cold/warm/hot)": "hot",
    "Origem": "Website",
    "Localização": "Lisboa",
    "Tipo de Imóvel (apartment/house/land/commercial/other)": "apartment",
    "Tipologia (T0/T1/T2/T3/T4/T5+)": "T2",
    "Orçamento": "250000",
    "Orçamento Mínimo": "200000",
    "Orçamento Máximo": "300000",
    "Área Mínima": "60",
    "Área Máxima": "90",
    "Prazo de Compra": "3 meses",
    "Precisa de Financiamento (true/false)": "true",
    "Tem Imóvel para Vender (true/false)": "false",
    "Aniversário (YYYY-MM-DD)": "1990-03-15",
    "Notas": "Interessado em apartamento T2 em Lisboa"
  },
  {
    "Nome *": "Maria Santos",
    "Email": "maria.santos@email.com",
    "Telefone": "+351 918 765 432",
    "Tipo * (buyer/seller/both)": "seller",
    "Estado * (new/qualified/visit/proposal/negotiation/won/lost)": "qualified",
    "Temperatura (cold/warm/hot)": "warm",
    "Origem": "Referência",
    "Localização": "Porto",
    "Tipo de Imóvel (apartment/house/land/commercial/other)": "apartment",
    "Tipologia (T0/T1/T2/T3/T4/T5+)": "T3",
    "Orçamento": "",
    "Orçamento Mínimo": "",
    "Orçamento Máximo": "",
    "Área Mínima": "",
    "Área Máxima": "",
    "Prazo de Compra": "",
    "Precisa de Financiamento (true/false)": "",
    "Tem Imóvel para Vender (true/false)": "true",
    "Aniversário (YYYY-MM-DD)": "1985-07-22",
    "Notas": "Quer vender apartamento T3 no Porto"
  },
  {
    "Nome *": "Pedro Costa",
    "Email": "pedro.costa@email.com",
    "Telefone": "+351 915 123 456",
    "Tipo * (buyer/seller/both)": "both",
    "Estado * (new/qualified/visit/proposal/negotiation/won/lost)": "negotiation",
    "Temperatura (cold/warm/hot)": "hot",
    "Origem": "Facebook",
    "Localização": "Cascais",
    "Tipo de Imóvel (apartment/house/land/commercial/other)": "apartment",
    "Tipologia (T0/T1/T2/T3/T4/T5+)": "T3",
    "Orçamento": "400000",
    "Orçamento Mínimo": "350000",
    "Orçamento Máximo": "450000",
    "Área Mínima": "80",
    "Área Máxima": "120",
    "Prazo de Compra": "6 meses",
    "Precisa de Financiamento (true/false)": "true",
    "Tem Imóvel para Vender (true/false)": "true",
    "Aniversário (YYYY-MM-DD)": "1988-11-30",
    "Notas": "Vende T2 e quer comprar T3 em Cascais"
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
    { "INSTRUÇÕES DE IMPORTAÇÃO": "1. Preencha uma lead por linha, na folha \"Leads\"." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "2. Os campos marcados com * são obrigatórios (Nome, Tipo, Estado)." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "3. Mantenha os cabeçalhos como estão (o texto entre parênteses é só ajuda)." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "4. Só estas colunas são importadas — apagar as linhas de exemplo antes de importar." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TIPO DE LEAD:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- buyer: Comprador" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- seller: Vendedor" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- both: Comprador e Vendedor" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "ESTADO (fase do pipeline):" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- new: Novo" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- qualified: Qualificado" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- visit: Visita" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- proposal: Proposta" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- negotiation: Negociação" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- won: Ganho   |   lost: Perdido" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TEMPERATURA:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- cold: Frio   |   warm: Morno   |   hot: Quente" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TIPO DE IMÓVEL:" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- apartment: Apartamento   |   house: Moradia" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "- land: Terreno   |   commercial: Comercial   |   other: Outro" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "TIPOLOGIA:  T0, T1, T2, T3, T4, T5+" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "ORÇAMENTO / ÁREA:  apenas números (ex.: 250000, 90). O símbolo € é opcional." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "PRAZO DE COMPRA:  texto livre (ex.: \"3 meses\", \"imediato\")." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "BOOLEANOS (Financiamento / Tem Imóvel para Vender):  true ou false." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "ANIVERSÁRIO:  YYYY-MM-DD (ex.: 1990-03-15)." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "Deixe em branco os campos que não se aplicam." },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "A MIGRAR DE OUTRO CRM? Não use este modelo — no botão \"Importar\", carregue" },
    { "INSTRUÇÕES DE IMPORTAÇÃO": "diretamente a exportação do MaxWork/Oportunidades: é reconhecida automaticamente." }
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