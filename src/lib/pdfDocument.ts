import { jsPDF } from "jspdf";

/**
 * Capa, cabeçalho e folha de fecho dos documentos entregues ao cliente.
 *
 * Partilhado pela Avaliação de Mercado e pela Simulação de Financiamento,
 * para os dois documentos terem a mesma identidade — é material que vai à
 * frente do cliente e a coerência conta.
 *
 * Os textos de apresentação e de fecho são escritos pelo consultor nas
 * Definições. Se não os tiver preenchido, essas páginas simplesmente não são
 * geradas: melhor um documento mais curto do que uma apresentação inventada.
 */

export interface ConsultantIdentity {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  amiLicense?: string | null;
  coverTitle?: string | null;
  aboutMe?: string | null;
  closingText?: string | null;
}

const BRAND = { r: 28, g: 43, b: 51 };
const ACCENT = { r: 37, g: 99, b: 235 };
const MUTED = { r: 107, g: 114, b: 128 };

const MARGIN = 18;

function formatToday(): string {
  return new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Capa: título do documento, referência (morada/cliente) e identificação do
 * consultor.
 */
export function addCoverPage(
  doc: jsPDF,
  params: { documentTitle: string; subtitle?: string; consultant: ConsultantIdentity }
): void {
  const { documentTitle, subtitle, consultant } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Faixa superior
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageWidth, 90, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);

  const titleLines = doc.splitTextToSize(documentTitle.toUpperCase(), pageWidth - MARGIN * 2);
  doc.text(titleLines, MARGIN, 45);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const subLines = doc.splitTextToSize(subtitle, pageWidth - MARGIN * 2);
    doc.text(subLines, MARGIN, 45 + titleLines.length * 11 + 4);
  }

  doc.setFontSize(10);
  doc.text(formatToday(), MARGIN, 78);

  // Identificação do consultor, em baixo
  let y = pageHeight - 62;

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(consultant.name, MARGIN, y);
  y += 7;

  if (consultant.coverTitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(consultant.coverTitle, MARGIN, y);
    y += 7;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);

  for (const line of [consultant.email, consultant.phone].filter(Boolean) as string[]) {
    doc.text(line, MARGIN, y);
    y += 5.5;
  }

  const footer = [consultant.companyName, consultant.amiLicense].filter(Boolean).join(" · ");
  if (footer) {
    y += 2;
    doc.setFontSize(9);
    doc.text(footer, MARGIN, y);
  }
}

/**
 * Folha de rosto com a apresentação do consultor.
 * Não faz nada se ele não a tiver escrito.
 */
export function addAboutPage(doc: jsPDF, consultant: ConsultantIdentity): void {
  if (!consultant.aboutMe?.trim()) return;

  doc.addPage();
  addPageHeader(doc, consultant, "Quem é o seu consultor");

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 52;

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(consultant.name, MARGIN, y);
  y += 8;

  if (consultant.coverTitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(consultant.coverTitle, MARGIN, y);
    y += 10;
  } else {
    y += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);

  // Respeita os parágrafos escritos pelo consultor.
  for (const paragraph of consultant.aboutMe.split(/\n\s*\n/)) {
    const lines = doc.splitTextToSize(paragraph.trim(), pageWidth - MARGIN * 2);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        addPageHeader(doc, consultant);
        y = 52;
      }
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 4;
  }
}

/** Folha de fecho com a mensagem final do consultor. */
export function addClosingPage(doc: jsPDF, consultant: ConsultantIdentity): void {
  if (!consultant.closingText?.trim()) return;

  doc.addPage();
  addPageHeader(doc, consultant);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 60;

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Próximos passos", MARGIN, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);

  for (const paragraph of consultant.closingText.split(/\n\s*\n/)) {
    const lines = doc.splitTextToSize(paragraph.trim(), pageWidth - MARGIN * 2);
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 4;
  }

  // Bloco de contacto
  y += 8;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(consultant.name, MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  for (const line of [consultant.email, consultant.phone].filter(Boolean) as string[]) {
    doc.text(line, MARGIN, y);
    y += 5;
  }
}

/**
 * Cabeçalho das páginas de conteúdo: identificação do consultor sempre
 * visível, como nos estudos de mercado das redes imobiliárias.
 */
export function addPageHeader(doc: jsPDF, consultant: ConsultantIdentity, sectionTitle?: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(consultant.name, MARGIN, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const contact = [consultant.email, consultant.phone].filter(Boolean).join("  ·  ");
  if (contact) doc.text(contact, MARGIN, 20);

  if (sectionTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(sectionTitle.toUpperCase(), pageWidth - MARGIN, 13, { align: "right" });
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(formatToday(), pageWidth - MARGIN, 20, { align: "right" });

  doc.setTextColor(0, 0, 0);
}

/** Numeração de páginas. Chamar no fim, quando o total já é conhecido. */
export function addPageNumbers(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // A capa não é numerada.
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`${i} / ${total}`, pageWidth - MARGIN, pageHeight - 10, { align: "right" });
  }
}

/** Lê a identidade do consultor a partir do perfil. */
export function buildConsultantIdentity(profile: any, fallbackEmail?: string): ConsultantIdentity {
  return {
    name: profile?.full_name || "Consultor Imobiliário",
    email: profile?.email || fallbackEmail || null,
    phone: profile?.phone || null,
    companyName: profile?.company_name || null,
    amiLicense: profile?.ami_license || null,
    coverTitle: profile?.document_cover_title || null,
    aboutMe: profile?.document_about_me || null,
    closingText: profile?.document_closing_text || null,
  };
}

// ============================================================
// Blocos de conteúdo estruturado
//
// O documento anterior despejava tudo em corrido: uma lista de comparáveis
// numa linha cada e um bloco único de análise. Estes blocos dão-lhe a
// estrutura por secções que se espera num estudo de mercado entregue ao
// proprietário.
// ============================================================

const eurPdf = (value: number): string =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

/** Título de secção, com filete de destaque. Devolve o novo y. */
export function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(MARGIN, y - 4, 3, 9, "F");

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title.toUpperCase(), MARGIN + 7, y + 3);

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 8, pageWidth - MARGIN, y + 8);

  return y + 16;
}

/**
 * Tabela de duas colunas (campo -> valor). As linhas sem valor são omitidas:
 * um documento entregue ao cliente não deve exibir "n/d" repetidamente.
 */
export function addKeyValueTable(
  doc: jsPDF,
  rows: Array<[string, string | null | undefined]>,
  y: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = rows.filter(([, value]) => value != null && String(value).trim() !== "");

  usable.forEach(([label, value], index) => {
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN, y - 4.5, pageWidth - MARGIN * 2, 8, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label, MARGIN + 3, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(String(value), MARGIN + 70, y, { maxWidth: pageWidth - MARGIN * 2 - 73 });

    y += 8;
  });

  return y + 4;
}

/**
 * Valor estimado apresentado como três âncoras (venda rápida, recomendado,
 * máximo) com o respetivo preço por metro quadrado.
 *
 * Um intervalo solto não ajuda o proprietário a decidir; três âncoras
 * nomeadas dizem-lhe o que significa cada extremo.
 */
export function addValueEstimate(
  doc: jsPDF,
  params: { min: number | null; max: number | null; area?: number | null },
  y: number
): number {
  const { min, max, area } = params;
  if (!min || !max) return y;

  const pageWidth = doc.internal.pageSize.getWidth();
  const mid = Math.round((min + max) / 2);
  const boxWidth = (pageWidth - MARGIN * 2 - 8) / 3;

  const perSqm = (value: number): string | null =>
    area && area > 0 ? `${eurPdf(Math.round(value / area))}/m2` : null;

  const columns: Array<{ label: string; value: number; highlight: boolean }> = [
    { label: "Venda rápida", value: min, highlight: false },
    { label: "Preço recomendado", value: mid, highlight: true },
    { label: "Valor máximo", value: max, highlight: false },
  ];

  columns.forEach((column, index) => {
    const x = MARGIN + index * (boxWidth + 4);

    if (column.highlight) {
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(x, y, boxWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(243, 244, 246);
      doc.rect(x, y, boxWidth, 30, "F");
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(column.label, x + 4, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(eurPdf(column.value), x + 4, y + 18);

    const sqm = perSqm(column.value);
    if (sqm) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(sqm, x + 4, y + 25);
    }
  });

  return y + 38;
}

export interface ComparableCard {
  status: "sold" | "active";
  address: string;
  price: number | null;
  area: number | null;
  pricePerSqm: number | null;
  propertyType?: string | null;
  energyRating?: string | null;
  yearBuilt?: number | null;
  daysOnMarket?: number | null;
  distanceKm?: number | null;
  features?: string[];
}

/**
 * Cartão de um comparável. Cada atributo só aparece quando existe — um
 * comparável sem classe energética não mostra a linha, em vez de mostrar "n/d".
 */
export function addComparableCard(doc: jsPDF, comparable: ComparableCard, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = pageWidth - MARGIN * 2;

  const attributes: string[] = [];
  if (comparable.area) attributes.push(`${comparable.area} m2`);
  if (comparable.pricePerSqm) attributes.push(`${eurPdf(comparable.pricePerSqm)}/m2`);
  if (comparable.yearBuilt) attributes.push(`Construção: ${comparable.yearBuilt}`);
  if (comparable.daysOnMarket != null) attributes.push(`${comparable.daysOnMarket} dias no mercado`);
  if (comparable.distanceKm != null) attributes.push(`${comparable.distanceKm.toFixed(2)} km`);
  if (comparable.energyRating) attributes.push(`Energia: ${comparable.energyRating}`);

  const featuresText = (comparable.features || []).filter(Boolean).join(", ");

  // Altura variável consoante o que há para mostrar.
  const featureLines: string[] = featuresText
    ? doc.splitTextToSize(`Características: ${featuresText}`, cardWidth - 10)
    : [];
  const cardHeight = 22 + (attributes.length ? 5 : 0) + featureLines.length * 4;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, y, cardWidth, cardHeight, 2, 2, "FD");

  // Vendido ancora valor real; ativo é apenas preço pedido. A distinção é
  // material para quem lê o documento, por isso vai destacada.
  const isSold = comparable.status === "sold";
  if (isSold) doc.setFillColor(22, 163, 74);
  else doc.setFillColor(156, 163, 175);
  doc.roundedRect(MARGIN + 4, y + 4, 18, 5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(isSold ? "VENDIDO" : "ATIVO", MARGIN + 6, y + 7.6);

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    comparable.price ? eurPdf(comparable.price) : "Preço não disponível",
    MARGIN + 26,
    y + 8.5
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    `${comparable.propertyType ? comparable.propertyType + " · " : ""}${comparable.address}`,
    MARGIN + 4,
    y + 15,
    { maxWidth: cardWidth - 10 }
  );

  let cursor = y + 20;
  if (attributes.length) {
    doc.setFontSize(8);
    doc.text(attributes.join("  ·  "), MARGIN + 4, cursor, { maxWidth: cardWidth - 10 });
    cursor += 5;
  }

  if (featureLines.length) {
    doc.setFontSize(8);
    doc.text(featureLines, MARGIN + 4, cursor);
  }

  return y + cardHeight + 5;
}

/**
 * Texto corrido de uma secção, com quebra de página automática.
 * Devolve o novo y, já na página certa.
 */
export function addBodyText(doc: jsPDF, text: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);

  const lines: string[] = doc.splitTextToSize(text, pageWidth - MARGIN * 2);
  for (const line of lines) {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, MARGIN, y);
    y += 4.6;
  }

  return y + 4;
}
