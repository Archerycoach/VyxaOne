/**
 * Envio de campanhas em massa por um ESP (Email Service Provider) transacional,
 * em vez do SMTP da caixa do consultor.
 *
 * PORQUÊ: uma caixa de correio normal (RE/MAX, Gmail, Outlook) tem limites de
 * envio apertados (centenas/hora) e mandar milhares queima a reputação e vai
 * para spam. Um ESP (Resend, etc.) envia por API HTTP de alto débito, com SPF/
 * DKIM próprios — rápido e entregável. Só as CAMPANHAS passam por aqui; os
 * emails transacionais/individuais continuam pelo SMTP do consultor.
 *
 * O "from" tem de ser um domínio VERIFICADO no ESP (ex.: um endereço @vyxa.pt).
 * Mostra-se o NOME do consultor e o reply-to é o email dele, para as respostas
 * caírem na caixa dele — mesmo que o endereço visível seja o do domínio do ESP.
 */

export interface EspConfig {
  /** "resend" (único suportado por agora) ou "" (desligado). */
  provider: string;
  apiKey: string;
  /** Endereço remetente num domínio verificado no ESP (ex.: envios@vyxa.pt). */
  fromEmail: string;
  /** Nome remetente por defeito, quando o consultor não tem um definido. */
  fromName: string | null;
}

/**
 * Lê a configuração do ESP das system_settings (global à instância). Devolve
 * null quando não está configurado — nesse caso o worker usa o SMTP normal.
 */
export async function getEspConfig(admin: any): Promise<EspConfig | null> {
  const { data } = await admin
    .from("system_settings")
    .select("key, value")
    .in("key", ["bulk_esp_provider", "bulk_esp_api_key", "bulk_esp_from_email", "bulk_esp_from_name"]);

  const map = new Map<string, string>((data ?? []).map((r: any) => [r.key, r.value]));
  const provider = String(map.get("bulk_esp_provider") || "").toLowerCase();
  const apiKey = String(map.get("bulk_esp_api_key") || "");
  const fromEmail = String(map.get("bulk_esp_from_email") || "");

  // Sem fornecedor, chave OU remetente verificado, não há ESP utilizável.
  if (!provider || !apiKey || !fromEmail) return null;

  return { provider, apiKey, fromEmail, fromName: (map.get("bulk_esp_from_name") as string) || null };
}

export interface EspSendParams {
  /** Nome do consultor (remetente visível). */
  fromName: string | null;
  /** Email do consultor — para onde vão as respostas (reply-to). */
  replyTo: string | null;
  to: string;
  subject: string;
  html: string;
  bcc?: string[];
  /** Anexos em base64 (filename + content) ou por URL (filename + path). */
  attachments?: Array<{ filename?: string; content?: string; path?: string }>;
}

/** Envia um email pelo ESP configurado. Lança em caso de erro (o worker trata). */
export async function sendViaEsp(config: EspConfig, params: EspSendParams): Promise<void> {
  if (config.provider === "resend") return sendViaResend(config, params);
  throw new Error(`ESP não suportado: ${config.provider}`);
}

async function sendViaResend(config: EspConfig, params: EspSendParams): Promise<void> {
  const fromName = params.fromName || config.fromName || "";
  const from = fromName ? `${fromName} <${config.fromEmail}>` : config.fromEmail;

  const body: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.replyTo) body.reply_to = params.replyTo;
  if (params.bcc && params.bcc.length > 0) body.bcc = params.bcc;

  if (params.attachments && params.attachments.length > 0) {
    const mapped = params.attachments
      .map((a) => ({ filename: a.filename, content: a.content, path: a.path }))
      .filter((a) => a.filename && (a.content || a.path));
    if (mapped.length > 0) body.attachments = mapped;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend ${response.status}: ${text.slice(0, 200)}`);
  }
}
