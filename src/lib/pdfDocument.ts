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
  /** Foto de perfil em data URI, para a folha de apresentação. */
  photoDataUri?: string | null;
}

/**
 * Cores do documento. São `let` e não `const` porque o consultor pode
 * escolhê-las nas Definições — `setDocumentTheme` é chamado antes de gerar.
 * Os valores aqui são o que se usa quando ele não escolheu nada.
 */
const DEFAULT_BRAND = { r: 28, g: 43, b: 51 };
const DEFAULT_ACCENT = { r: 37, g: 99, b: 235 };

let BRAND = { ...DEFAULT_BRAND };
let ACCENT = { ...DEFAULT_ACCENT };
const MUTED = { r: 107, g: 114, b: 128 };

/** "#1c2b33" → {r,g,b}. Devolve null se não for um hex válido. */
function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Define as cores do documento. Chamar ANTES de desenhar seja o que for —
 * as funções de desenho leem estas variáveis no momento em que correm.
 */
/**
 * Espaço reservado no fundo de cada página para a faixa de rodapé.
 *
 * Sem isto, o conteúdo era escrito até ao fundo e a faixa — desenhada depois
 * — ficava por cima do texto. Definido antes de gerar, como o tema.
 */
let FOOTER_RESERVE_MM = 0;

export function setFooterReserve(mm: number): void {
  FOOTER_RESERVE_MM = Math.max(0, mm);
}

export function getFooterReserve(): number {
  return FOOTER_RESERVE_MM;
}

export function setDocumentTheme(theme: { brand?: string | null; accent?: string | null }): void {
  BRAND = hexToRgb(theme.brand) || { ...DEFAULT_BRAND };
  ACCENT = hexToRgb(theme.accent) || { ...DEFAULT_ACCENT };
}

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

  // Título e morada centrados — é o que se espera numa capa, e é a mesma
  // composição usada quando o consultor carrega uma capa própria.
  const centerX = pageWidth / 2;
  const titleLines = doc.splitTextToSize(documentTitle.toUpperCase(), pageWidth - MARGIN * 2);
  doc.text(titleLines, centerX, 42, { align: "center" });

  let cursor = 42 + titleLines.length * 11 + 4;

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const subLines = doc.splitTextToSize(subtitle, pageWidth - MARGIN * 2);
    doc.text(subLines, centerX, cursor, { align: "center" });
    cursor += subLines.length * 6 + 2;
  }

  doc.setFontSize(10);
  doc.text(formatToday(), centerX, Math.min(cursor + 4, 80), { align: "center" });

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

  // Foto de perfil à direita do nome. O texto recua para não lhe passar por
  // baixo; sem foto, ocupa a largura toda como antes.
  const photoSize = 32;
  let textWidth = pageWidth - MARGIN * 2;

  if (consultant.photoDataUri) {
    try {
      doc.addImage(
        consultant.photoDataUri,
        "JPEG",
        pageWidth - MARGIN - photoSize,
        y - 10,
        photoSize,
        photoSize
      );
      textWidth = pageWidth - MARGIN * 2 - photoSize - 8;
    } catch {
      // Foto ilegível: a página sai sem ela.
    }
  }

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
    y += 6;
  }

  // Contactos e AMI: informacao que o cliente procura e que nao aparecia em
  // lado nenhum do documento.
  const identityLine = [
    consultant.companyName,
    consultant.amiLicense ? `AMI ${consultant.amiLicense}` : null,
    consultant.phone,
    consultant.email,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (identityLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(identityLine, MARGIN, y, { maxWidth: textWidth });
    y += 10;
  } else {
    y += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);

  // Respeita os parágrafos escritos pelo consultor.
  for (const paragraph of consultant.aboutMe.split(/\n\s*\n/)) {
    // A largura reduzida so vale enquanto o texto corre ao lado da foto;
    // abaixo dela volta a ocupar a pagina toda.
    const usableWidth = y < 74 ? textWidth : pageWidth - MARGIN * 2;
    const lines = doc.splitTextToSize(paragraph.trim(), usableWidth);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - 30 - FOOTER_RESERVE_MM) {
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
    photoDataUri: profile?.photoDataUri || null,
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
export function addSectionTitle(doc: jsPDF, rawTitle: string, y: number): number {
  const title = pdfSafeText(rawTitle);
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
  conditionLabel?: string | null;
  /** Fotografia do anúncio, em data URI (embebida no servidor). */
  thumbnailDataUri?: string | null;
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
  // O estado do comparável explica desvios de €/m² que de outra forma pareceriam
  // arbitrários a quem lê o documento.
  if (comparable.conditionLabel) attributes.push(comparable.conditionLabel);

  const featuresText = (comparable.features || []).filter(Boolean).join(", ");

  // Altura variável consoante o que há para mostrar.
  const featureLines: string[] = featuresText
    ? doc.splitTextToSize(`Características: ${featuresText}`, cardWidth - 10)
    : [];
  const cardHeight = 22 + (attributes.length ? 5 : 0) + featureLines.length * 4;

  // Com fotografia, o conteúdo recua para lhe dar lugar à esquerda.
  const photoWidth = comparable.thumbnailDataUri ? 26 : 0;
  const contentX = MARGIN + photoWidth + (photoWidth ? 3 : 0);

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, y, cardWidth, cardHeight, 2, 2, "FD");

  if (comparable.thumbnailDataUri) {
    try {
      doc.addImage(
        comparable.thumbnailDataUri,
        "JPEG",
        MARGIN + 2,
        y + 2,
        photoWidth - 2,
        cardHeight - 4
      );
    } catch {
      // Imagem ilegível: o cartão sai sem ela.
    }
  }

  // Vendido ancora valor real; ativo é apenas preço pedido. A distinção é
  // material para quem lê o documento, por isso vai destacada.
  const isSold = comparable.status === "sold";
  if (isSold) doc.setFillColor(22, 163, 74);
  else doc.setFillColor(156, 163, 175);
  doc.roundedRect(contentX + 4, y + 4, 18, 5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(isSold ? "VENDIDO" : "ATIVO", contentX + 6, y + 7.6);

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    comparable.price ? eurPdf(comparable.price) : "Preço não disponível",
    contentX + 26,
    y + 8.5
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    `${comparable.propertyType ? comparable.propertyType + " · " : ""}${comparable.address}`,
    contentX + 4,
    y + 15,
    { maxWidth: cardWidth - photoWidth - 10 }
  );

  let cursor = y + 20;
  if (attributes.length) {
    doc.setFontSize(8);
    doc.text(attributes.join("  ·  "), contentX + 4, cursor, { maxWidth: cardWidth - photoWidth - 10 });
    cursor += 5;
  }

  if (featureLines.length) {
    doc.setFontSize(8);
    doc.text(featureLines, contentX + 4, cursor);
  }

  return y + cardHeight + 5;
}

/**
 * Torna o texto seguro para as fontes standard do jsPDF (WinAnsi/CP1252).
 *
 * Caracteres fora dessa codificação saem como lixo e desalinham a linha
 * inteira (era o "!'" no lugar da seta → e o espaçamento esticado nos números
 * dos cenários): setas viram "->", espaços especiais (U+00A0/U+202F, que o
 * toLocaleString/Intl usa como separador de milhares) viram espaço normal, e
 * aspas tipográficas viram aspas simples.
 */
export function pdfSafeText(input: string): string {
  return String(input ?? "")
    .replace(/[→➔➡⇒]/g, "->")
    .replace(/[      ⁠﻿]/g, " ")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/−/g, "-");
}

/**
 * Texto corrido de uma secção, com quebra de página automática.
 * Devolve o novo y, já na página certa.
 */
export function addBodyText(doc: jsPDF, rawText: string, y: number): number {
  const text = pdfSafeText(rawText);
  return addBodyTextSafe(doc, text, y);
}

function addBodyTextSafe(doc: jsPDF, text: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);

  const lines: string[] = doc.splitTextToSize(text, pageWidth - MARGIN * 2);
  for (const line of lines) {
    if (y > pageHeight - 25 - FOOTER_RESERVE_MM) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, MARGIN, y);
    y += 4.6;
  }

  return y + 4;
}

export interface LocationPoi {
  name: string;
  category: string;
  walkMinutes: number;
}

const POI_SECTION_LABELS: Record<string, string> = {
  escolas: "Escolas",
  transportes: "Transportes",
  comercio: "Supermercados",
  restauracao: "Restauração",
  saude: "Saúde",
};

/**
 * Mapa da localização. A imagem vem em data URI do servidor (Geoapify);
 * sem chave configurada não há imagem e a secção é simplesmente omitida.
 */
export function addLocationMap(doc: jsPDF, mapDataUri: string | null, y: number): number {
  if (!mapDataUri) return y;

  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN * 2;
  const height = width * (360 / 640); // proporção pedida ao Geoapify

  try {
    doc.addImage(mapDataUri, "JPEG", MARGIN, y, width, height);
  } catch (error) {
    // Uma imagem corrompida não pode impedir o documento de sair.
    console.warn("[pdfDocument] Mapa não embebido:", error);
    return y;
  }

  doc.setFontSize(7);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("Mapa: © OpenStreetMap contributors · Geoapify", MARGIN, y + height + 4);

  return y + height + 10;
}

/**
 * Pontos de interesse agrupados por categoria, em duas colunas.
 *
 * Os tempos são estimativas a partir da distância em linha reta — o documento
 * di-lo explicitamente, para não passarem por percursos medidos.
 */
export function addPointsOfInterest(doc: jsPDF, pois: LocationPoi[], y: number): number {
  if (!pois || pois.length === 0) return y;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const columnWidth = (pageWidth - MARGIN * 2 - 8) / 2;

  const categories = Array.from(new Set(pois.map((poi) => poi.category)));

  let column = 0;
  let columnTop = y;
  let cursor = y;
  // O fundo mais baixo das DUAS colunas — a nota de atribuição tem de ficar
  // abaixo de ambas, não à altura da coluna onde o cursor calhou a acabar
  // (era isso que a punha em cima do título "Transportes").
  let maxBottom = y;

  for (const category of categories) {
    const items = pois.filter((poi) => poi.category === category);
    const blockHeight = 8 + items.length * 5.5 + 6;

    // Muda de coluna, e só depois de página — duas colunas aproveitam melhor
    // o espaço numa lista de nomes curtos.
    if (cursor + blockHeight > pageHeight - 25 - FOOTER_RESERVE_MM) {
      if (column === 0) {
        column = 1;
        cursor = columnTop;
      } else {
        doc.addPage();
        column = 0;
        columnTop = 25;
        cursor = 25;
        // Página nova, contador novo: sem isto, o maxBottom da página
        // anterior arrastava a nota de atribuição para o fundo da página
        // seguinte, longe da lista.
        maxBottom = 25;
      }
    }

    const x = MARGIN + column * (columnWidth + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(POI_SECTION_LABELS[category] || category, x, cursor);
    cursor += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    for (const item of items) {
      const minutes = `${item.walkMinutes} min`;
      const minutesWidth = doc.getTextWidth(minutes);

      doc.setTextColor(55, 65, 81);
      // Trunca o nome para o tempo nunca ser empurrado para fora da coluna.
      const name = doc.splitTextToSize(item.name, columnWidth - minutesWidth - 6)[0];
      doc.text(name, x, cursor);

      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      doc.text(minutes, x + columnWidth - minutesWidth, cursor);

      cursor += 5.5;
    }

    cursor += 6;
    maxBottom = Math.max(maxBottom, cursor);
  }

  doc.setFontSize(7);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    "Tempos a pé estimados a partir da distância. Dados: © OpenStreetMap contributors.",
    MARGIN,
    Math.min(maxBottom + 3, pageHeight - 12 - FOOTER_RESERVE_MM)
  );

  return maxBottom + 10;
}

/**
 * Narrativa da IA renderizada com a estrutura que ela própria produziu.
 *
 * O relatório vem em HTML com títulos (h3), parágrafos e listas. A versão
 * anterior fazia `replace(/<[^>]+>/g, " ")` e mandava tudo para o PDF como um
 * bloco corrido de texto — a estrutura existia e era deitada fora à entrada,
 * o que tornava a análise um muro de texto impossível de percorrer.
 */

interface NarrativeBlock {
  type: "heading" | "paragraph" | "bullet";
  text: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, "€");
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** HTML → blocos. Ignora o que não reconhece em vez de o mostrar cru. */
export function parseNarrativeBlocks(html: string): NarrativeBlock[] {
  const blocks: NarrativeBlock[] = [];
  const pattern = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const text = cleanText(match[2]);
    if (!text) continue;

    if (tag.startsWith("h")) blocks.push({ type: "heading", text });
    else if (tag === "li") blocks.push({ type: "bullet", text });
    else blocks.push({ type: "paragraph", text });
  }

  // Sem nenhuma etiqueta reconhecida, mostra-se o texto todo em vez de nada.
  if (blocks.length === 0) {
    const fallback = cleanText(html);
    if (fallback) blocks.push({ type: "paragraph", text: fallback });
  }

  return blocks;
}

/**
 * Escreve a narrativa no PDF respeitando títulos, parágrafos e listas, com
 * quebra de página automática. Devolve o novo y.
 */
export function addNarrative(
  doc: jsPDF,
  html: string,
  y: number,
  onNewPage?: () => number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const blocks = parseNarrativeBlocks(html || "");

  const newPage = (): number => {
    doc.addPage();
    return onNewPage ? onNewPage() : 25;
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      // Um título isolado no fim da página fica órfão do texto que anuncia.
      if (y > pageHeight - 40) y = newPage();
      else y += 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text(block.text, MARGIN, y);
      y += 6;
      continue;
    }

    const isBullet = block.type === "bullet";
    const indent = isBullet ? 5 : 0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);

    const lines: string[] = doc.splitTextToSize(
      block.text,
      pageWidth - MARGIN * 2 - indent
    );

    lines.forEach((line, index) => {
      if (y > pageHeight - 25 - FOOTER_RESERVE_MM) y = newPage();

      if (isBullet && index === 0) {
        doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
        doc.text("•", MARGIN, y);
        doc.setTextColor(55, 65, 81);
      }

      doc.text(line, MARGIN + indent, y);
      y += 4.6;
    });

    y += isBullet ? 1.5 : 3.5;
  }

  return y;
}

/**
 * Contraste entre o que o mercado PEDE e o que efetivamente PAGA.
 *
 * É a informação mais útil de todo o documento para um proprietário a decidir
 * o preço: os anúncios que ele vê no portal não são vendas, são pedidos. Sem
 * este contraste, ele compara o seu imóvel com preços que ninguém pagou.
 */
export function addAskingVsSoldBlock(
  doc: jsPDF,
  params: {
    askingPricePerSqm: number;
    soldPricePerSqm: number;
    gapPct: number;
    zoneName?: string | null;
  },
  y: number
): number {
  const { askingPricePerSqm, soldPricePerSqm, gapPct, zoneName } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - MARGIN * 2;
  const boxHeight = 34;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(
    `PEDIDO vs PAGO${zoneName ? ` — ${zoneName}` : ""}`,
    MARGIN + 5,
    y + 7
  );

  const columnWidth = (boxWidth - 10) / 3;

  const columns: Array<{ label: string; value: string; accent: boolean }> = [
    {
      label: "Pedido nos anúncios",
      value: `${Math.round(askingPricePerSqm).toLocaleString("pt-PT")} €/m²`,
      accent: false,
    },
    {
      label: "Pago em escritura (INE)",
      value: `${Math.round(soldPricePerSqm).toLocaleString("pt-PT")} €/m²`,
      accent: true,
    },
    {
      label: gapPct >= 0 ? "Pede-se acima do que se paga" : "Pede-se abaixo do que se paga",
      value: `${gapPct > 0 ? "+" : ""}${gapPct}%`,
      accent: false,
    },
  ];

  columns.forEach((column, index) => {
    const x = MARGIN + 5 + index * columnWidth;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(column.label, x, y + 16, { maxWidth: columnWidth - 4 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    // O valor de escritura vai destacado: é o que ancora a decisão.
    if (column.accent) doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    else doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(column.value, x, y + 27);
  });

  return y + boxHeight + 6;
}
