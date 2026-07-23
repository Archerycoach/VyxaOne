import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capa, contracapa e rodapé personalizados nos documentos entregues ao cliente.
 *
 * O jsPDF sabe desenhar páginas mas NÃO sabe importar páginas de outro PDF.
 * Por isso o documento é montado em duas fases: o jsPDF desenha o conteúdo e
 * o pdf-lib junta-lhe a capa e a contracapa do consultor.
 *
 * O rodapé é diferente — repete-se em todas as páginas de conteúdo, por isso
 * é desenhado pelo jsPDF antes da fusão, como imagem.
 */

const BUCKET = "documents";

export interface CoverOverlay {
  title: string;
  subtitle?: string | null;
  date?: string | null;
}

export interface DocumentBranding {
  coverPdfPath?: string | null;
  aboutPdfPath?: string | null;
  closingPdfPath?: string | null;
  footerImagePath?: string | null;
}

/** Descarrega um ficheiro do storage. Devolve null em vez de lançar. */
async function downloadAsset(path: string | null | undefined): Promise<ArrayBuffer | null> {
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) {
      console.warn("[documentBranding] Não foi possível descarregar:", path, error);
      return null;
    }
    return await data.arrayBuffer();
  } catch (error) {
    console.warn("[documentBranding] Erro ao descarregar:", path, error);
    return null;
  }
}

/** Imagem do rodapé como data URI, para o jsPDF a desenhar em cada página. */
export async function loadFooterImage(path: string | null | undefined): Promise<string | null> {
  const buffer = await downloadAsset(path);
  if (!buffer) return null;

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  // O tipo é inferido da assinatura do ficheiro — mais fiável do que a extensão.
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  return `data:image/${isPng ? "png" : "jpeg"};base64,${btoa(binary)}`;
}

/**
 * Desenha a faixa de rodapé no fundo de todas as páginas.
 *
 * Chamar DEPOIS de todo o conteúdo estar escrito e antes da numeração, para a
 * faixa ficar por baixo do número da página e não o tapar.
 */
export function addFooterBand(doc: jsPDF, footerDataUri: string | null): void {
  if (!footerDataUri) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // A altura deriva das proporções REAIS da imagem. Forçar uma altura fixa
  // esmagava a faixa: uma imagem quadrada espremida para 14 mm de altura a
  // toda a largura fica irreconhecível.
  let bandHeight: number;
  try {
    const properties = (doc as any).getImageProperties(footerDataUri);
    const ratio = properties.height / properties.width;
    bandHeight = pageWidth * ratio;
  } catch {
    // Sem forma de medir, um valor discreto é mais seguro do que deformar.
    bandHeight = 12;
  }

  // As dimensões da IMAGEM mandam: largura total da página, altura pela
  // proporção real, e é a página que reserva o espaço correspondente
  // (setFooterReserve). Encolher ou centrar a faixa — as tentativas
  // anteriores — deixava-a sempre diferente da capa que usa o mesmo design.
  //
  // Único limite: um terço da página. Acima disso a "faixa" é um cartaz e
  // comeria o documento; reduz-se mantendo a forma, centrada.
  const MAX_BAND_HEIGHT = doc.internal.pageSize.getHeight() / 3;
  let drawWidth = pageWidth;
  let drawX = 0;

  if (bandHeight > MAX_BAND_HEIGHT) {
    const scale = MAX_BAND_HEIGHT / bandHeight;
    drawWidth = pageWidth * scale;
    drawX = (pageWidth - drawWidth) / 2;
    bandHeight = MAX_BAND_HEIGHT;
  }

  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    try {
      doc.addImage(
        footerDataUri,
        "PNG",
        drawX,
        pageHeight - bandHeight,
        drawWidth,
        bandHeight
      );
    } catch {
      // Formato não suportado — o documento sai sem faixa, não parte.
      return;
    }
  }
}

/** Altura ocupada pela faixa, para reservar espaço ANTES de desenhar. */
export function footerBandHeight(doc: jsPDF, footerDataUri: string | null): number {
  if (!footerDataUri) return 0;
  try {
    const properties = (doc as any).getImageProperties(footerDataUri);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // A mesma fórmula do addFooterBand — os dois têm de concordar, senão a
    // reserva não bate certo com o que é desenhado.
    return Math.min(pageWidth * (properties.height / properties.width), pageHeight / 3);
  } catch {
    return 12;
  }
}

/**
 * Junta a capa e a contracapa do consultor ao documento gerado.
 *
 * Devolve os bytes do PDF final. Se nenhum dos ficheiros existir ou falhar,
 * devolve o documento original intacto — um PDF de capa corrompido não pode
 * impedir a entrega da avaliação.
 */
export async function mergeBrandingPages(
  doc: jsPDF,
  branding: DocumentBranding,
  overlay?: CoverOverlay | null
): Promise<Uint8Array> {
  const generated = doc.output("arraybuffer");

  const [coverBytes, aboutBytes, closingBytes] = await Promise.all([
    downloadAsset(branding.coverPdfPath),
    downloadAsset(branding.aboutPdfPath),
    downloadAsset(branding.closingPdfPath),
  ]);

  try {
    const output = await PDFDocument.create();

    const appendAll = async (bytes: ArrayBuffer) => {
      const source = await PDFDocument.load(bytes);
      const pages = await output.copyPages(source, source.getPageIndices());
      for (const page of pages) output.addPage(page);
    };

    // Ordem final: capa → apresentação → conteúdo → contracapa.
    // A apresentação entra aqui e não dentro do jsPDF porque é um PDF
    // completo, não algo que se desenhe.
    if (coverBytes) {
      const before = output.getPageCount();
      await appendAll(coverBytes);
      // O título e a morada são escritos POR CIMA da capa carregada, na
      // primeira página dela. A capa do consultor traz o design; o documento
      // traz a informação de que imóvel se trata.
      if (overlay) {
        await drawCoverOverlay(output, before, overlay);
      }
    }
    if (aboutBytes) await appendAll(aboutBytes);
    await appendAll(generated);
    if (closingBytes) await appendAll(closingBytes);

    // Numeração DEPOIS da fusão, com o total real. Numerar antes dava
    // "2 / 9" num documento de 12 páginas — o total ignorava a capa e a
    // apresentação carregadas. A capa não é numerada, por convenção.
    const font = await output.embedFont(StandardFonts.Helvetica);
    const total = output.getPageCount();
    for (let index = 1; index < total; index++) {
      const page = output.getPage(index);
      const label = `${index + 1} / ${total}`;
      const size = 8;
      page.drawText(label, {
        x: page.getSize().width - font.widthOfTextAtSize(label, size) - 24,
        y: 14,
        size,
        font,
        color: rgb(0.45, 0.47, 0.5),
      });
    }

    return await output.save();
  } catch (error) {
    console.warn("[documentBranding] Fusão falhou; entregue o documento original:", error);
    return new Uint8Array(generated);
  }
}

/**
 * Escreve o título e a morada no centro da capa carregada.
 *
 * Por baixo do texto vai uma faixa branca semi-opaca: sem ela, um título
 * escuro sobre uma fotografia escura fica ilegível, e não há forma de saber
 * de antemão o que o consultor carregou.
 */
async function drawCoverOverlay(
  output: PDFDocument,
  pageIndex: number,
  overlay: CoverOverlay
): Promise<void> {
  const page = output.getPage(pageIndex);
  const { width, height } = page.getSize();

  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const regular = await output.embedFont(StandardFonts.Helvetica);

  const titleSize = 16;
  const subtitleSize = 12;
  const dateSize = 10;

  // Uma morada longa não cabe numa linha — quebra por palavras à medida.
  const wrap = (text: string, font: typeof bold, size: number): string[] => {
    const maxWidth = width - 90;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const lines: Array<{ text: string; font: typeof bold; size: number }> = [];
  for (const line of wrap(overlay.title, bold, titleSize)) {
    lines.push({ text: line, font: bold, size: titleSize });
  }
  if (overlay.subtitle) {
    for (const line of wrap(overlay.subtitle, regular, subtitleSize)) {
      lines.push({ text: line, font: regular, size: subtitleSize });
    }
  }
  if (overlay.date) lines.push({ text: overlay.date, font: regular, size: dateSize });

  const lineGap = 10;
  const blockHeight = lines.reduce((sum, line) => sum + line.size + lineGap, 0);
  const bandPadding = 18;
  const bandHeight = blockHeight + bandPadding * 2;
  const bandY = height / 2 - bandHeight / 2;

  page.drawRectangle({
    x: 0,
    y: bandY,
    width,
    height: bandHeight,
    color: rgb(1, 1, 1),
    opacity: 0.88,
  });

  let cursor = bandY + bandHeight - bandPadding;
  for (const line of lines) {
    cursor -= line.size;
    const textWidth = line.font.widthOfTextAtSize(line.text, line.size);
    page.drawText(line.text, {
      x: width / 2 - textWidth / 2,
      y: cursor,
      size: line.size,
      font: line.font,
      color: rgb(0.11, 0.17, 0.2),
    });
    cursor -= lineGap;
  }
}

/** Guarda o PDF final no disco do utilizador. */
export function saveMergedPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** O consultor carregou uma capa própria? Decide se a capa gerada é usada. */
export function hasCustomCover(branding: DocumentBranding): boolean {
  return Boolean(branding.coverPdfPath);
}

/** Idem para a folha de apresentação. */
export function hasCustomAbout(branding: DocumentBranding): boolean {
  return Boolean(branding.aboutPdfPath);
}

/**
 * Foto de perfil como data URI, para a folha de apresentacao.
 *
 * O avatar e uma URL publica (nao um caminho de storage), por isso e obtida
 * por fetch e nao pelo cliente de storage.
 */
export async function loadProfilePhoto(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return `data:image/${isPng ? "png" : "jpeg"};base64,${btoa(binary)}`;
  } catch (error) {
    console.warn("[documentBranding] Foto de perfil nao carregada:", error);
    return null;
  }
}
