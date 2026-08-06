import crypto from "crypto";

/**
 * Conversions API para Lead Ads — avisa a Meta de que um lead recebido pelo
 * webhook foi processado, com email/telefone com hash (nunca em claro).
 *
 * NÃO é preciso para os leads continuarem a chegar — o webhook já funciona
 * sozinho. Isto é o feedback que a Meta usa para otimizar a entrega dos
 * anúncios (leads mais parecidos com os que realmente avançam).
 *
 * Cada consultor liga o seu próprio Dataset (Events Manager → Fontes de
 * Dados → Conversions API → Gerar token de acesso), guardado em
 * meta_integrations.capi_dataset_id / capi_access_token.
 */

const GRAPH_API_VERSION = "v18.0"; // mesma versão já usada no resto do webhook.ts

/**
 * Normaliza e faz hash SHA256 de um email, no formato que a Meta exige:
 * minúsculas, sem espaços à volta.
 */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normaliza e faz hash SHA256 de um telefone: só dígitos, com código de país,
 * sem "+", espaços ou outros símbolos — como a Meta exige para o campo "ph".
 * Assume Portugal (351) quando o número não vem com indicativo — é o mesmo
 * pressuposto já feito no resto da app para leads sem indicativo explícito.
 */
export function hashPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && !digits.startsWith("351")) {
    digits = `351${digits}`;
  }
  return crypto.createHash("sha256").update(digits).digest("hex");
}

export interface LeadConversionEventParams {
  datasetId: string;
  accessToken: string;
  leadgenId: string;
  email?: string | null;
  phone?: string | null;
  /** Timestamp Unix (segundos) de quando o lead foi recebido. */
  eventTime: number;
}

export interface LeadConversionEventResult {
  ok: boolean;
  error?: string;
}

/**
 * Envia o evento "Lead" à Conversions API. Nunca lança — é sempre chamado a
 * seguir a um lead já criado com sucesso, e uma falha aqui (token expirado,
 * dataset errado) não pode desfazer nem bloquear esse lead.
 */
export async function sendLeadConversionEvent(
  params: LeadConversionEventParams
): Promise<LeadConversionEventResult> {
  const { datasetId, accessToken, leadgenId, email, phone, eventTime } = params;

  const userData: Record<string, unknown> = { lead_id: leadgenId };
  if (email) userData.em = [hashEmail(email)];
  if (phone) userData.ph = [hashPhone(phone)];

  const body = {
    data: [
      {
        action_source: "system_generated",
        event_name: "Lead",
        event_time: eventTime,
        custom_data: {
          event_source: "crm",
          lead_event_source: "VyxaOne",
        },
        user_data: userData,
      },
    ],
  };

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${datasetId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      const message = data?.error?.message || `HTTP ${response.status}`;
      console.error("[metaConversionsApi] Falha ao enviar evento:", message);
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error("[metaConversionsApi] Erro de rede:", error);
    return { ok: false, error: String(error?.message || error) };
  }
}
