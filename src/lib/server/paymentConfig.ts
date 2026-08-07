import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Configuração de pagamentos, com as chaves geridas em Admin › Definições de
 * Pagamento (system_settings.payment_config). Fallback para variáveis de
 * ambiente quando o valor não está na BD. As chaves NUNCA são expostas ao
 * browser a partir daqui (só a chave pública do Stripe, via endpoint próprio).
 */
export interface PaymentConfig {
  stripeEnabled: boolean;
  stripePublicKey: string;
  stripeSecretKey: string;
  // ifthenpay: uma chave por método (ver src/lib/ifthenpay.ts) — não uma
  // chave única como a EuPago tinha.
  ifthenpayEnabled: boolean;
  ifthenpayMbwayKey: string;
  ifthenpayMbKey: string;
  ifthenpayCreditCardKey: string;
  ifthenpayAntiPhishingKey: string;
  mbwayEnabled: boolean;
  testMode: boolean;
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  let raw: any = {};
  try {
    const { data } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "payment_config")
      .maybeSingle();
    raw = (data?.value as any) || {};
  } catch (error) {
    console.error("[paymentConfig] Falha a ler payment_config; a usar env:", error);
  }

  return {
    stripeEnabled: raw.stripe_enabled ?? false,
    stripePublicKey: raw.stripe_public_key || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    stripeSecretKey: raw.stripe_secret_key || process.env.STRIPE_SECRET_KEY || "",
    ifthenpayEnabled: raw.ifthenpay_enabled ?? false,
    ifthenpayMbwayKey: raw.ifthenpay_mbway_key || process.env.IFTHENPAY_MBWAY_KEY || "",
    ifthenpayMbKey: raw.ifthenpay_mb_key || process.env.IFTHENPAY_MB_KEY || "",
    ifthenpayCreditCardKey: raw.ifthenpay_creditcard_key || process.env.IFTHENPAY_CREDITCARD_KEY || "",
    ifthenpayAntiPhishingKey: raw.ifthenpay_antiphishing_key || process.env.IFTHENPAY_ANTIPHISHING_KEY || "",
    mbwayEnabled: raw.mbway_enabled ?? false,
    testMode: raw.test_mode ?? true,
  };
}
