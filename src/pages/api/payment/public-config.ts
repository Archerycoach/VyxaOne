import type { NextApiRequest, NextApiResponse } from "next";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

/**
 * Config de pagamento SEGURA para o browser: apenas a chave PÚBLICA do Stripe
 * (não secreta) e que métodos estão ativos. As chaves secretas nunca saem do
 * servidor.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }
  try {
    const cfg = await getPaymentConfig();
    return res.status(200).json({
      stripePublishableKey: cfg.stripePublicKey,
      methods: {
        stripe: cfg.stripeEnabled && !!cfg.stripeSecretKey && !!cfg.stripePublicKey,
        mbway: cfg.eupagoEnabled && cfg.mbwayEnabled && !!cfg.eupagoApiKey,
        multibanco: cfg.eupagoEnabled && !!cfg.eupagoApiKey,
      },
      testMode: cfg.testMode,
    });
  } catch (error: any) {
    console.error("[payment/public-config]", error);
    return res.status(500).json({ error: error.message || "Erro" });
  }
}
