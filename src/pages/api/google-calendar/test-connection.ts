import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { type } = req.body;
    
    if (type === "admin") {
      const { data, error } = await supabaseAdmin
        .from("integration_settings")
        .select("*")
        .eq("integration_name", "google_calendar")
        .maybeSingle();

      if (error || !data || !data.client_id || !data.client_secret) {
        return res.status(400).json({ success: false, message: "Configuração não encontrada ou incompleta na base de dados." });
      }
      return res.status(200).json({ success: true, message: "Credenciais de API do Google Calendar estão configuradas corretamente no servidor." });
    } else {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Invalid session" });

      const { data: integration } = await supabaseAdmin
        .from("google_calendar_integrations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!integration || !integration.access_token) {
        return res.status(400).json({ success: false, message: "Não existe ligação ativa ao Google Calendar para esta conta." });
      }

      const googleRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
        headers: { Authorization: `Bearer ${integration.access_token}` }
      });

      if (!googleRes.ok) {
        if (googleRes.status === 401) {
           return res.status(400).json({ success: false, message: "O token expirou ou foi revogado pela Google. Volte a ligar a conta nas definições." });
        }
        return res.status(400).json({ success: false, message: `Falha na comunicação com a Google (Status: ${googleRes.status}).` });
      }

      return res.status(200).json({ success: true, message: "Ligação ativa e a comunicar com a conta Google com sucesso!" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}