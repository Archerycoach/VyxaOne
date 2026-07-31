import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const config = { maxDuration: 30 };

/**
 * Painel financeiro do admin: custos de IA (de ai_usage_logs, em USD) vs
 * proveitos (pagamentos recebidos em EUR + MRR das subscrições ativas).
 *
 * Tudo apresentado em EUR: os custos USD são convertidos por uma taxa
 * configurável (system_settings.ai_usd_to_eur_rate, default 0,92).
 *
 * Admin-only (service-role). GET agrega; POST grava a taxa de câmbio.
 */

const DEFAULT_FX = 0.92;

function periodStart(period: string): string | null {
  const now = new Date();
  switch (period) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "last_month":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    case "quarter": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return d.toISOString();
    }
    case "year":
      return new Date(now.getFullYear(), 0, 1).toISOString();
    case "all":
    default:
      return null;
  }
}

/** Fim do período (só relevante para "last_month"). */
function periodEnd(period: string): string | null {
  if (period !== "last_month") return null;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/** Lê todas as linhas (contorna o cap de 1000 do PostgREST) por paginação. */
async function fetchAll(
  db: any,
  table: string,
  columns: string,
  build: (q: any) => any,
): Promise<any[]> {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let page = 0; page < 100; page++) {
    let q = db.from(table).select(columns).range(page * pageSize, page * pageSize + pageSize - 1);
    q = build(q);
    const { data, error } = await q;
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

const monthsOf = (interval: string | null | undefined): number =>
  interval === "yearly" ? 12 : interval === "semiannual" ? 6 : 1;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Não autorizado" });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return res.status(403).json({ error: "Acesso negado. Apenas admin." });
  }

  const db = supabaseAdmin as any;

  try {
    // Taxa de câmbio USD->EUR (configurável).
    const { data: fxRow } = await db
      .from("system_settings")
      .select("value")
      .eq("key", "ai_usd_to_eur_rate")
      .maybeSingle();
    const fxRate = (() => {
      const raw = fxRow?.value;
      const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(/"/g, ""));
      return Number.isFinite(n) && n > 0 ? n : DEFAULT_FX;
    })();

    if (req.method === "POST") {
      const rate = parseFloat(String(req.body?.fxRate));
      if (!Number.isFinite(rate) || rate <= 0) {
        return res.status(400).json({ error: "Taxa inválida." });
      }
      await db
        .from("system_settings")
        .upsert({ key: "ai_usd_to_eur_rate", value: String(rate), updated_at: new Date().toISOString() }, { onConflict: "key" });
      return res.status(200).json({ success: true, fxRate: rate });
    }

    const period = (req.query.period as string) || "month";
    const start = periodStart(period);
    const end = periodEnd(period);

    // --- Custos de IA (USD) ---------------------------------------------------
    const aiRows = await fetchAll(db, "ai_usage_logs", "estimated_cost, model, task, input_tokens, output_tokens", (q: any) => {
      let r = q;
      if (start) r = r.gte("created_at", start);
      if (end) r = r.lt("created_at", end);
      return r;
    });

    let aiUsd = 0, calls = 0, inTok = 0, outTok = 0;
    const byModel = new Map<string, { calls: number; usd: number; inTok: number; outTok: number }>();
    const byTask = new Map<string, { calls: number; usd: number }>();
    for (const r of aiRows) {
      const cost = Number(r.estimated_cost) || 0;
      aiUsd += cost; calls += 1;
      inTok += Number(r.input_tokens) || 0;
      outTok += Number(r.output_tokens) || 0;
      const m = byModel.get(r.model) || { calls: 0, usd: 0, inTok: 0, outTok: 0 };
      m.calls += 1; m.usd += cost; m.inTok += Number(r.input_tokens) || 0; m.outTok += Number(r.output_tokens) || 0;
      byModel.set(r.model, m);
      const t = byTask.get(r.task) || { calls: 0, usd: 0 };
      t.calls += 1; t.usd += cost; byTask.set(r.task, t);
    }
    const aiEur = aiUsd * fxRate;

    // --- Receita recebida (EUR) ----------------------------------------------
    const payRows = await fetchAll(db, "payment_history", "amount, currency, status, payment_method, payment_date, created_at", (q: any) => {
      let r = q.eq("status", "completed");
      if (start) r = r.gte("created_at", start);
      if (end) r = r.lt("created_at", end);
      return r;
    });
    let receivedEur = 0;
    for (const p of payRows) {
      if ((p.currency || "EUR").toUpperCase() === "EUR") receivedEur += Number(p.amount) || 0;
    }
    const recentPayments = [...payRows]
      .sort((a, b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime())
      .slice(0, 10)
      .map((p) => ({
        date: p.payment_date || p.created_at,
        amount: Number(p.amount) || 0,
        currency: p.currency || "EUR",
        method: p.payment_method || "-",
      }));

    // --- MRR das subscrições ativas (snapshot, não depende do período) --------
    const subs = await fetchAll(
      db,
      "subscriptions",
      "status, subscription_plans!inner(price, currency, billing_interval)",
      (q: any) => q.in("status", ["active", "trialing"]),
    );
    let mrrEur = 0, activeCount = 0, trialingCount = 0;
    for (const s of subs) {
      const plan = s.subscription_plans;
      if (s.status === "trialing") { trialingCount += 1; continue; }
      activeCount += 1;
      if (plan && (plan.currency || "EUR").toUpperCase() === "EUR") {
        mrrEur += (Number(plan.price) || 0) / monthsOf(plan.billing_interval);
      }
    }

    return res.status(200).json({
      period,
      fxRate,
      ai: {
        usd: aiUsd,
        eur: aiEur,
        calls,
        inputTokens: inTok,
        outputTokens: outTok,
        byModel: Array.from(byModel.entries())
          .map(([model, v]) => ({ model, calls: v.calls, usd: v.usd, eur: v.usd * fxRate, inputTokens: v.inTok, outputTokens: v.outTok }))
          .sort((a, b) => b.usd - a.usd),
        byTask: Array.from(byTask.entries())
          .map(([task, v]) => ({ task, calls: v.calls, usd: v.usd, eur: v.usd * fxRate }))
          .sort((a, b) => b.usd - a.usd),
      },
      revenue: { receivedEur, payments: payRows.length, recent: recentPayments },
      mrr: { monthlyEur: mrrEur, arrEur: mrrEur * 12, activeCount, trialingCount },
      net: { profitEur: receivedEur - aiEur },
    });
  } catch (error: any) {
    console.error("[admin/finance] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao calcular finanças." });
  }
}
