import type { NextApiRequest } from "next";

/**
 * URL base da INSTÂNCIA que serve o pedido — para usar em links de emails e
 * mensagens (opt-in, unsubscribe, portal, documentos, CRM). Deriva do host do
 * pedido: a instância que envia é a mesma que serve essas páginas e detém os
 * tokens na sua BD. Evita apontar para outra instância / www.vyxa.pt.
 *
 * Fallbacks apenas quando não há host (contexto sem pedido): NEXT_PUBLIC_APP_URL
 * e, por último, o domínio institucional.
 */
export function deriveAppUrl(req: NextApiRequest): string {
  const host = (req.headers.host as string) || "";
  if (host) {
    const proto = (req.headers["x-forwarded-proto"] as string) || (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt";
}
