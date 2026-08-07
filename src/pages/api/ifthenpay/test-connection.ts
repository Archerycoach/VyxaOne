import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ifthenpay } from "@/lib/ifthenpay";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

/**
 * Teste SEGURO da ligação à ifthenpay (admin). Gera uma referência Multibanco
 * de valor simbólico: confirma que a chave Multibanco autentica e que a
 * integração responde. NÃO cobra nada — uma referência só move dinheiro se
 * alguém a pagar; e aqui NÃO se grava em payment_history.
 *
 * Ao contrário da EuPago, a ifthenpay não distingue sandbox/produção por
 * URL — testa-se com a mesma chave que será usada em produção, ou com as
 * chaves de demonstração públicas da ifthenpay antes de teres as tuas.
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
    if (!cfg.ifthenpayMbKey) {
      return res.status(400).json({ ok: false, error: "Chave Multibanco da ifthenpay não configurada." });
    }

    const ref = await ifthenpay.createMultibancoReference({
      amount: 1.0,
      reference: `TEST-${Date.now()}`,
      description: "Teste de ligação ifthenpay (não pagar)",
    });

    return res.status(200).json({
      ok: true,
      entity: ref.entity,
      reference: ref.reference,
      message: "Ligação OK — a chave Multibanco autentica e gera referências. (Referência de teste, não pagar.)",
    });
  } catch (error: any) {
    // ifthenpay.ts já inclui o detalhe da resposta da ifthenpay no erro.
    return res.status(200).json({
      ok: false,
      error: error?.message || "Falha na ligação à ifthenpay.",
    });
  }
}
