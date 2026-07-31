import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { eupago } from "@/lib/eupago";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

/**
 * Teste SEGURO da ligação à EuPago (admin). Gera uma referência Multibanco de
 * valor simbólico: autentica a chave contra o URL certo (sandbox/produção
 * conforme o test_mode) e confirma que a integração responde. NÃO cobra nada —
 * uma referência Multibanco só move dinheiro se alguém a pagar; e aqui NÃO se
 * grava em payment_history. Se quiser, pode pagar a referência gerada para
 * testar também o webhook (aí sim, dinheiro real).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Não autorizado" });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "broker")) {
    return res.status(403).json({ error: "Acesso negado. Apenas admin." });
  }

  try {
    const cfg = await getPaymentConfig();
    if (!cfg.eupagoApiKey) {
      return res.status(400).json({ ok: false, error: "Chave EuPago não configurada." });
    }

    const ref = await eupago.createMultibancoReference({
      amount: 1.0,
      reference: `TEST-${Date.now()}`,
      description: "Teste de ligação EuPago (não pagar)",
    });

    return res.status(200).json({
      ok: true,
      testMode: cfg.testMode,
      environment: cfg.testMode ? "sandbox" : "produção",
      entity: ref.entity,
      reference: ref.reference,
      message: cfg.testMode
        ? "Ligação OK, mas em MODO SANDBOX. Desligue o 'Modo de teste' para usar a chave de produção."
        : "Ligação de PRODUÇÃO OK — a chave autentica e gera referências. (Referência de teste, não pagar.)",
    });
  } catch (error: any) {
    // A eupago.ts já inclui o detalhe da resposta da EuPago no erro.
    const cfg = await getPaymentConfig().catch(() => null);
    return res.status(200).json({
      ok: false,
      testMode: cfg?.testMode,
      environment: cfg?.testMode ? "sandbox" : "produção",
      error: error?.message || "Falha na ligação à EuPago.",
    });
  }
}
