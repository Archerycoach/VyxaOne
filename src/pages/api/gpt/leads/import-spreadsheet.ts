import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import XLSX from "xlsx";
import { parseRows, type ParsedLead } from "@/lib/server/leadSpreadsheetImport";
import { getPipelineStagesForLead } from "@/lib/server/pipelineStages";

/**
 * Importa leads a partir de um ficheiro de exportação de outro CRM.
 *
 * Duas fases, controladas por `apply`:
 *   apply: false → analisa e devolve o resumo, sem gravar nada.
 *   apply: true  → grava.
 *
 * Regras:
 * - Leads novas entram com a data de criação ORIGINAL, para ficarem no seu
 *   lugar cronológico na lista em vez de aparecerem todas como de hoje.
 * - Leads que já existam (mesmo email ou telefone) são ATUALIZADAS apenas nos
 *   campos em falta — nunca sobrepomos o que o consultor já preencheu ou
 *   corrigiu à mão.
 * - O histórico de contactos entra como interações, sem duplicar em
 *   reimportações.
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "24mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { fileBase64, apply } = req.body as { fileBase64?: string; apply?: boolean };

  if (!fileBase64) {
    return res.status(400).json({ error: "Ficheiro não fornecido." });
  }

  try {
    const base64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
    const workbook = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

    const parsed = parseRows(rows);

    if (parsed.format === "desconhecido") {
      return res.status(422).json({
        error:
          "Formato não reconhecido. Este importador aceita as exportações de Leads (MaxWork) e de Oportunidades.",
      });
    }

    if (parsed.leads.length === 0) {
      return res.status(200).json({
        success: true,
        format: parsed.format,
        totalRows: rows.length,
        toCreate: 0,
        toUpdate: 0,
        skipped: parsed.skipped.length,
        activities: 0,
      });
    }

    // Leads já existentes deste consultor, por email e por telefone.
    const { data: existingLeads } = await (supabaseAdmin as any)
      .from("leads")
      .select("id, email, phone, name, created_at, source, lead_type, property_type, bedrooms, budget, location_preference, notes, temperature")
      .eq("user_id", user.id);

    const byEmail = new Map<string, any>();
    const byPhone = new Map<string, any>();
    for (const lead of existingLeads || []) {
      if (lead.email) byEmail.set(String(lead.email).toLowerCase(), lead);
      if (lead.phone) byPhone.set(normalizeDigits(lead.phone), lead);
    }

    const findExisting = (lead: ParsedLead) => {
      if (lead.email && byEmail.has(lead.email)) return byEmail.get(lead.email);
      if (lead.phone) {
        const key = normalizeDigits(lead.phone);
        if (key && byPhone.has(key)) return byPhone.get(key);
      }
      return null;
    };

    // Fases válidas, para não gravar um estado que o pipeline não conhece.
    const buyerStages = await getPipelineStagesForLead(supabaseAdmin, "buyer");
    const sellerStages = await getPipelineStagesForLead(supabaseAdmin, "seller");
    const validStage = (stage: string | null, type: string | null) => {
      if (!stage) return null;
      const stages = type === "seller" ? sellerStages : buyerStages;
      return stages.includes(stage) ? stage : null;
    };

    const toCreate: ParsedLead[] = [];
    const toUpdate: Array<{ lead: ParsedLead; existingId: string }> = [];

    for (const lead of parsed.leads) {
      const existing = findExisting(lead);
      if (existing) toUpdate.push({ lead, existingId: existing.id });
      else toCreate.push(lead);
    }

    const activityCount = parsed.leads.reduce((n, l) => n + l.activities.length, 0);

    if (!apply) {
      // Quantas leads já existentes vão ter a data de criação corrigida para
      // trás — o sinal que mostra ao consultor que a importação anterior vai
      // ser reparada.
      const willCorrectDates = toUpdate.filter(({ lead, existingId }) => {
        if (!lead.created_at) return false;
        const current = (existingLeads || []).find((e: any) => e.id === existingId);
        if (!current?.created_at) return true;
        return new Date(lead.created_at).getTime() < new Date(current.created_at).getTime();
      }).length;

      return res.status(200).json({
        success: true,
        applied: false,
        format: parsed.format,
        totalRows: rows.length,
        toCreate: toCreate.length,
        toUpdate: toUpdate.length,
        datesCorrected: willCorrectDates,
        skipped: parsed.skipped.length,
        skippedReasons: summarise(parsed.skipped),
        activities: activityCount,
        sample: parsed.leads.slice(0, 5).map((l) => ({
          name: l.name,
          email: l.email,
          phone: l.phone,
          created_at: l.created_at,
          activities: l.activities.length,
        })),
      });
    }

    let created = 0;
    let updated = 0;
    let interactions = 0;
    let datesCorrected = 0;

    for (const lead of parsed.leads) {
      const existing = findExisting(lead);
      const stage = validStage(lead.status, lead.lead_type);

      let leadId: string;

      if (existing) {
        // Só preenche buracos — nunca sobrepõe o que já lá está.
        const fill: Record<string, unknown> = {};
        const maybe = (field: string, value: unknown) => {
          if (value === null || value === undefined || value === "") return;
          const current = (existing as Record<string, unknown>)[field];
          if (current === null || current === undefined || current === "") {
            fill[field] = value;
          }
        };

        maybe("email", lead.email);
        maybe("phone", lead.phone);
        maybe("source", lead.source);
        maybe("lead_type", lead.lead_type);
        maybe("property_type", lead.property_type);
        maybe("bedrooms", lead.bedrooms);
        maybe("budget", lead.budget);
        maybe("location_preference", lead.location_preference);
        maybe("notes", lead.notes);
        maybe("temperature", lead.temperature);

        // Data de criação: corrige-se para a data REAL de origem sempre que
        // esta for anterior à que está no Vyxa.
        //
        // É o que repara as importações anteriores, em que as leads ficaram
        // com a data do dia da importação: pareciam recentes, ficavam no topo
        // da lista e escapavam à reativação de leads frias. Só recuamos
        // (nunca avançamos) para não envelhecer indevidamente uma lead que
        // tenha sido criada no Vyxa antes do que consta no ficheiro.
        if (lead.created_at && existing.created_at) {
          const fromFile = new Date(lead.created_at).getTime();
          const inVyxa = new Date(existing.created_at).getTime();
          if (Number.isFinite(fromFile) && fromFile < inVyxa) {
            fill.created_at = lead.created_at;
            datesCorrected++;
          }
        } else if (lead.created_at && !existing.created_at) {
          fill.created_at = lead.created_at;
          datesCorrected++;
        }

        if (Object.keys(fill).length > 0) {
          await (supabaseAdmin as any)
            .from("leads")
            .update({ ...fill, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          updated++;
        }
        leadId = existing.id;
      } else {
        const { data: inserted, error } = await (supabaseAdmin as any)
          .from("leads")
          .insert({
            user_id: user.id,
            assigned_to: user.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            source: lead.source,
            status: stage || undefined,
            temperature: lead.temperature,
            lead_type: lead.lead_type,
            property_type: lead.property_type,
            bedrooms: lead.bedrooms,
            budget: lead.budget,
            location_preference: lead.location_preference,
            notes: lead.notes,
            // Data original: é isto que põe a lead no seu lugar cronológico.
            created_at: lead.created_at || undefined,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          console.error(`[import-spreadsheet] Erro na linha ${lead.row}:`, error);
          continue;
        }
        created++;
        leadId = inserted.id;

        // Evita reimportar a mesma lead como nova numa segunda passagem.
        if (lead.email) byEmail.set(lead.email, { id: leadId });
        if (lead.phone) byPhone.set(normalizeDigits(lead.phone), { id: leadId });
      }

      // Histórico de contactos. Só o que ainda não existe, comparando data e
      // conteúdo — reimportar o mesmo ficheiro não duplica.
      if (lead.activities.length > 0) {
        const { data: current } = await (supabaseAdmin as any)
          .from("interactions")
          .select("interaction_date, content")
          .eq("lead_id", leadId)
          .limit(500);

        const seen = new Set(
          (current || []).map((i: any) => `${i.interaction_date}|${(i.content || "").substring(0, 60)}`)
        );

        const rowsToInsert = lead.activities
          .filter((a) => a.date && !seen.has(`${a.date}|${a.description.substring(0, 60)}`))
          .map((a) => ({
            lead_id: leadId,
            user_id: user.id,
            interaction_type: a.type,
            content: a.description,
            outcome: a.user ? `Registado por ${a.user}` : null,
            interaction_date: a.date,
          }));

        if (rowsToInsert.length > 0) {
          const { error } = await (supabaseAdmin as any).from("interactions").insert(rowsToInsert);
          if (!error) interactions += rowsToInsert.length;
        }
      }
    }

    return res.status(200).json({
      success: true,
      applied: true,
      format: parsed.format,
      totalRows: rows.length,
      created,
      updated,
      interactions,
      datesCorrected,
      skipped: parsed.skipped.length,
    });
  } catch (error: any) {
    console.error("[import-spreadsheet] Erro:", error);
    return res.status(500).json({ error: error.message || "Não foi possível ler o ficheiro." });
  }
}

function normalizeDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function summarise(skipped: Array<{ reason: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of skipped) {
    const key = s.reason.replace(/\(.*\)/, "").trim();
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}
