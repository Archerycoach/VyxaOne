/**
 * Início de um envio de emails em massa a partir do cliente.
 *
 * Parte o envio em pedidos pequenos para nunca estourar o limite de tamanho da
 * plataforma (a Vercel rejeita pedidos acima de ~4.5MB): primeiro cria a
 * campanha (com o modelo + anexos), depois adiciona os destinatários em blocos.
 * O último bloco arranca o processamento em segundo plano no servidor.
 */

export interface BulkRecipientInput {
  email: string;
  name?: string;
  vars?: Record<string, string>;
  leadId?: string | null;
  contactId?: string | null;
}

export interface BulkEmailAttachmentInput {
  filename: string;
  /** Link do ficheiro na Storage (formato novo — o worker descarrega no envio). */
  url?: string;
  /** Conteúdo base64 (formato antigo, mantido para templates/campanhas guardados). */
  content?: string;
  encoding?: string;
}

/** Lê a resposta como JSON de forma tolerante — se vier uma página de erro
 *  (413, HTML, etc.), devolve uma mensagem legível em vez de rebentar com
 *  "JSON.parse: unexpected character". */
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: (text || "").trim().slice(0, 200) || `HTTP ${res.status}` };
  }
}

const RECIPIENT_CHUNK = 400;

export async function startBulkEmailSend(params: {
  accessToken: string;
  subject: string;
  html: string;
  attachments: BulkEmailAttachmentInput[];
  sendCopyToSender: boolean;
  audienceSource: string;
  criteria: Record<string, unknown>;
  recipients: BulkRecipientInput[];
}): Promise<{ campaignId: string; queued: number }> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${params.accessToken}`,
  };

  // Deduplicar por email antes de enviar.
  const seen = new Set<string>();
  const clean = params.recipients.filter((r) => {
    const email = (r.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
  if (clean.length === 0) {
    throw new Error("Nenhum destinatário com email.");
  }

  // 1. Criar a campanha (com anexos). Sem destinatários — pedido pequeno.
  const createRes = await fetch("/api/bulk-email/enqueue", {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
      sendCopyToSender: params.sendCopyToSender,
      audienceSource: params.audienceSource,
      criteria: params.criteria,
      recipientsTotal: clean.length,
    }),
  });
  const createData = await readJson(createRes);
  if (!createRes.ok || !createData?.campaignId) {
    throw new Error(createData?.error || `Não foi possível criar a campanha (HTTP ${createRes.status}).`);
  }
  const campaignId: string = createData.campaignId;

  // 2. Adicionar os destinatários em blocos; o último arranca o envio.
  for (let i = 0; i < clean.length; i += RECIPIENT_CHUNK) {
    const batch = clean.slice(i, i + RECIPIENT_CHUNK);
    const isLast = i + RECIPIENT_CHUNK >= clean.length;
    const addRes = await fetch("/api/bulk-email/enqueue-recipients", {
      method: "POST",
      headers,
      body: JSON.stringify({ campaignId, recipients: batch, start: isLast }),
    });
    const addData = await readJson(addRes);
    if (!addRes.ok || !addData?.success) {
      throw new Error(addData?.error || `Falha ao preparar os destinatários (HTTP ${addRes.status}).`);
    }
  }

  return { campaignId, queued: clean.length };
}
