import type { Property, Development, DevelopmentTypology } from "@/types";

/**
 * Compõe o texto factual dos imóveis a divulgar num email por procura.
 *
 * A IA (chat.ts, campaignContext.listingContent) recebe este texto e escreve
 * o email usando APENAS estes factos — por isso incluímos só dados reais e
 * estruturados, um bloco por imóvel, separados por "---". Suporta imóveis da
 * carteira (properties + developments) e conteúdos externos (brochura/link).
 */

const priceFmt = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });

function priceRange(from?: number | null, to?: number | null): string | null {
  if (from != null && to != null) return from === to ? priceFmt.format(from) : `${priceFmt.format(from)} a ${priceFmt.format(to)}`;
  if (from != null) return `desde ${priceFmt.format(from)}`;
  if (to != null) return `até ${priceFmt.format(to)}`;
  return null;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  commercial: "Comercial",
  land: "Terreno",
  office: "Escritório",
  warehouse: "Armazém",
  other: "Imóvel",
};

export function buildPropertyBlock(property: Property, appOrigin?: string): string {
  const lines: string[] = [];
  lines.push(`IMÓVEL: ${property.title}`);
  lines.push(`Tipo: ${PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}`);
  if (property.typology) lines.push(`Tipologia: ${property.typology}`);
  else if (property.bedrooms != null) lines.push(`Quartos: ${property.bedrooms}`);
  if (property.price) lines.push(`Preço: ${priceFmt.format(property.price)}`);
  if (property.area) lines.push(`Área: ${numFmt.format(property.area)} m²`);
  const location = [property.address, property.city, property.district].filter(Boolean).join(", ");
  if (location) lines.push(`Localização: ${location}`);
  if (property.features?.length) lines.push(`Características: ${property.features.join(", ")}`);
  if (property.energy_rating) lines.push(`Certificado energético: ${property.energy_rating}`);
  const propRef = (property as any).reference_code;
  if (propRef) lines.push(`Referência: ${propRef}`);
  const token = (property as any).landing_token;
  if (appOrigin && token && (property as any).landing_published) {
    lines.push(`Link: ${appOrigin}/l/${token}`);
  }
  return lines.join("\n");
}

export function buildDevelopmentBlock(
  development: Development,
  typologies: DevelopmentTypology[],
  appOrigin?: string
): string {
  const lines: string[] = [];
  lines.push(`EMPREENDIMENTO: ${development.name}`);
  const location = [development.address, development.city, development.district].filter(Boolean).join(", ");
  if (location) lines.push(`Localização: ${location}`);
  if (development.developer_name) lines.push(`Promotor: ${development.developer_name}`);

  if (typologies.length > 0) {
    lines.push("Tipologias:");
    for (const t of typologies) {
      const parts = [
        priceRange(t.price_from, t.price_to),
        (t.area_from != null || t.area_to != null)
          ? `${t.area_from ?? "?"}–${t.area_to ?? "?"} m²`
          : null,
        t.units_available != null ? `${t.units_available} disponível(is)` : null,
      ].filter(Boolean);
      lines.push(`- ${t.typology}${parts.length ? `: ${parts.join(" · ")}` : ""}`);
    }
  } else {
    const range = priceRange(development.price_from, development.price_to);
    if (range) lines.push(`Preços: ${range}`);
    if (development.typologies?.length) lines.push(`Tipologias: ${development.typologies.join(", ")}`);
  }

  if (development.amenities?.length) lines.push(`Amenities: ${development.amenities.join(", ")}`);
  if (development.delivery_date) lines.push(`Conclusão prevista: ${new Date(development.delivery_date).toLocaleDateString("pt-PT")}`);
  if (development.payment_terms) lines.push(`Condições de pagamento: ${development.payment_terms}`);
  if (development.reservation_terms) lines.push(`Condições de reserva: ${development.reservation_terms}`);
  const token = (development as any).landing_token;
  if (appOrigin && token && (development as any).landing_published) {
    lines.push(`Link: ${appOrigin}/l/${token}`);
  }
  return lines.join("\n");
}

/**
 * Junta todos os blocos (carteira + externos) num único texto. Devolve null
 * se não houver nenhum imóvel — nesse caso a campanha corre sem divulgar
 * imóvel específico, como antes.
 */
export function joinListingBlocks(blocks: string[]): string | null {
  const clean = blocks.map((b) => b.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return clean.join("\n\n---\n\n");
}
