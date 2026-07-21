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
