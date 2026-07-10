import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Testa as credenciais da app Meta (App ID/App Secret) do lado do servidor.
 * O App Secret nunca deve sair do servidor — antes disto, o teste era feito
 * diretamente no browser (ver git blame de MetaAppSettings.tsx), expondo o
 * secret no tráfego de rede do cliente.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem executar esta ação." });
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from("meta_app_settings")
      .select("app_id, app_secret")
      .single();

    if (!settings?.app_id || !settings?.app_secret) {
      return res.status(400).json({ success: false, error: "App ID / App Secret não configurados." });
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${settings.app_id}&client_secret=${settings.app_secret}&grant_type=client_credentials`
    );
    const data = await response.json();

    if (response.ok && data.access_token) {
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: false, error: data.error?.message || "Não foi possível validar as credenciais." });
  } catch (error: any) {
    console.error("[meta/test-connection] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno ao testar a ligação." });
  }
}
