import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Lista os calendários do Google do consultor (GET) e guarda quais importar
 * para a agenda Vyxa (POST). Para quem tem mais do que um calendário na conta.
 */

/** Devolve um access token válido (renova se expirado). Null se não der. */
async function getValidAccessToken(integration: any): Promise<string | null> {
  const isExpired = new Date(integration.expires_at).getTime() <= Date.now();
  if (!isExpired) return integration.access_token;
  if (!integration.refresh_token) return null;

  const { data: settings } = await (supabaseAdmin
    .from("integration_settings" as any)
    .select("client_id, client_secret")
    .eq("integration_name", "google_calendar")
    .maybeSingle());
  const s = settings as any;
  if (!s?.client_id || !s?.client_secret) return null;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.client_id,
      client_secret: s.client_secret,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) return null;
  const tokens = await tokenResponse.json();
  await (supabaseAdmin
    .from("google_calendar_integrations" as any)
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("id", integration.id));
  return tokens.access_token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { data: integration } = await (supabaseAdmin
      .from("google_calendar_integrations" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle());

    if (!integration) return res.status(404).json({ error: "Google Calendar não ligado" });
    const integ = integration as any;

    // POST: guardar a seleção de calendários a importar.
    if (req.method === "POST") {
      const { calendarIds } = req.body as { calendarIds?: string[] };
      const primary = integ.calendar_id || "primary";
      const clean = Array.isArray(calendarIds)
        ? Array.from(new Set(calendarIds.filter((c) => typeof c === "string" && c.trim() && c !== primary)))
        : [];
      const { error } = await (supabaseAdmin
        .from("google_calendar_integrations" as any)
        .update({ import_calendar_ids: clean })
        .eq("id", integ.id));
      if (error) return res.status(500).json({ error: "Não foi possível guardar a seleção." });
      return res.status(200).json({ success: true, selected: clean });
    }

    // GET: listar os calendários da conta Google.
    if (req.method === "GET") {
      const accessToken = await getValidAccessToken(integ);
      if (!accessToken) {
        return res.status(401).json({ error: "Sessão do Google expirada. Volte a ligar a conta.", requiresReconnect: true });
      }

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: "Falha ao obter os calendários do Google.", details: text.slice(0, 150) });
      }
      const data = await response.json();
      const calendars = (data.items || []).map((c: any) => ({
        id: c.id,
        summary: c.summaryOverride || c.summary || c.id,
        primary: !!c.primary,
        backgroundColor: c.backgroundColor || null,
        accessRole: c.accessRole || null,
      }));

      const primaryCalendarId = integ.calendar_id || calendars.find((c: any) => c.primary)?.id || "primary";
      const selected = Array.isArray(integ.import_calendar_ids) ? integ.import_calendar_ids : [];

      return res.status(200).json({ calendars, selected, primaryCalendarId });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (error: any) {
    console.error("[google-calendar/calendars]", error);
    return res.status(500).json({ error: error.message || "Erro ao obter calendários." });
  }
}
