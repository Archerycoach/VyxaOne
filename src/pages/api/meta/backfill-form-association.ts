import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * POST /api/meta/backfill-form-association
 *
 * Aplica a associação (imóvel/empreendimento) de um formulário Meta às leads
 * que JÁ entraram por esse formulário.
 *
 * O webhook só associa as leads no momento em que chegam — quem configura a
 * associação depois de a campanha já estar a correr fica com as leads antigas
 * por associar. Este endpoint fecha essa lacuna.
 *
 * Só preenche leads sem empreendimento; nunca sobrepõe uma associação
 * existente (uma correção manual do consultor tem sempre prioridade).
 *
 * Body: { form_id: string, dry_run?: boolean }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { form_id, dry_run } = req.body as { form_id?: string; dry_run?: boolean };
    if (!form_id) {
      return res.status(400).json({ error: "form_id is required" });
    }

    // Um form_id pode ter mais do que uma linha de configuração (integrações
    // diferentes), por isso não se usa maybeSingle — rebentaria em vez de
    // devolver a configuração.
    const { data: configs, error: configError } = await supabase
      .from("meta_form_configs")
      .select("form_id, form_name, custom_settings, user_id")
      .eq("form_id", form_id)
      .limit(5);

    if (configError) throw configError;

    const formConfig = (configs ?? []).find(
      (row: any) => (row.custom_settings || {}).association_type === "development"
    ) || (configs ?? [])[0];

    if (!formConfig) {
      return res.status(404).json({ error: "Formulário não encontrado." });
    }

    // Autorização: dono da configuração, ou broker/admin (que gere a conta).
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    const managesAccount = profile?.role === "broker" || profile?.role === "admin";
    if (formConfig.user_id !== user.id && !managesAccount) {
      return res.status(403).json({ error: "Sem permissão para alterar este formulário." });
    }

    const settings = (formConfig.custom_settings || {}) as Record<string, any>;
    const associationType = settings.association_type;

    if (associationType !== "development") {
      return res.status(400).json({
        error:
          "Este formulário não está associado a um empreendimento. Configure a associação antes de aplicar às leads antigas.",
      });
    }

    const developmentId: string | null =
      typeof settings.associated_development_id === "string" ? settings.associated_development_id : null;
    const developmentName: string | null =
      typeof settings.associated_development_name === "string" ? settings.associated_development_name : null;

    if (!developmentId && !developmentName) {
      return res.status(400).json({ error: "A associação do formulário está incompleta." });
    }

    // Leads deste formulário que ainda não têm empreendimento.
    //
    // Não se filtra por `user_id = utilizador atual`: o webhook grava em
    // `user_id` o dono da integração e em `assigned_to` o consultor a quem a
    // lead foi distribuída, pelo que essa igualdade deixava de fora
    // exatamente as leads que é preciso corrigir. A permissão já foi
    // verificada acima, ao nível do formulário.
    let leadsQuery: any = supabase
      .from("leads")
      .select("id")
      .eq("meta_form_id", form_id)
      .is("development_id", null);

    if (!managesAccount) {
      leadsQuery = leadsQuery.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
    }

    const { data: candidates, error: leadsError } = await leadsQuery;

    if (leadsError) throw leadsError;

    const ids = (candidates ?? []).map((lead: any) => lead.id);

    // Total do formulário — permite distinguir "já estão todas associadas" de
    // "este formulário não tem leads nenhumas", que é a diferença entre não
    // haver trabalho e haver um problema.
    const { count: totalInForm } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("meta_form_id", form_id);

    if (dry_run) {
      return res.status(200).json({
        success: true,
        dry_run: true,
        would_update: ids.length,
        total_in_form: totalInForm ?? 0,
        development_name: developmentName,
        form_name: formConfig.form_name,
      });
    }

    if (ids.length === 0) {
      return res.status(200).json({
        success: true,
        updated: 0,
        development_name: developmentName,
        form_name: formConfig.form_name,
      });
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        is_development: true,
        development_id: developmentId,
        development_name: developmentName,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      updated: ids.length,
      development_name: developmentName,
      form_name: formConfig.form_name,
    });
  } catch (error: any) {
    console.error("[meta/backfill-form-association]", error);
    return res.status(500).json({ error: error?.message || "Erro ao aplicar a associação." });
  }
}
