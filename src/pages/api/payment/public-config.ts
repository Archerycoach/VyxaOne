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
    // Consolidado num só gateway (ifthenpay), mas cada método tem a sua
    // própria chave — só aparece disponível o que tiver chave configurada.
    return res.status(200).json({
      methods: {
        card: cfg.ifthenpayEnabled && !!cfg.ifthenpayCreditCardKey,
        mbway: cfg.ifthenpayEnabled && cfg.mbwayEnabled && !!cfg.ifthenpayMbwayKey,
        multibanco: cfg.ifthenpayEnabled && !!cfg.ifthenpayMbKey,
      },
      testMode: cfg.testMode,
    });
  } catch (error: any) {
    console.error("[payment/public-config]", error);
    return res.status(500).json({ error: error.message || "Erro" });
  }
}
