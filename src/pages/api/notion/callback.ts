import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, error } = req.query;

  if (error) {
    console.error("Notion OAuth error:", error);
    return res.redirect(302, "/settings?error=notion_auth_failed");
  }

  if (!code || typeof code !== "string" || !state || typeof state !== "string") {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const decodedState = JSON.parse(decodeURIComponent(state));
    const userId = decodedState.userId;

    if (!userId) {
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    // Fetch Notion settings from the database
    const { data: configData, error: settingsError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration_name', 'notion')
      .maybeSingle();

    const settings = (configData?.settings as any) || {};

    if (settingsError || !settings.client_id || !settings.client_secret) {
      console.error("Missing Notion configuration in database");
      return res.redirect(302, "/settings?error=notion_not_configured");
    }

    const clientId = settings.client_id;
    const clientSecret = settings.client_secret;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/notion/callback`;

    // Exchange code for token
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Notion token exchange failed:", tokenData);
      return res.redirect(302, "/settings?error=notion_token_exchange_failed");
    }

    // Save or update the integration in the database
    const { error: upsertError } = await supabase
      .from("notion_integrations")
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        bot_id: tokenData.bot_id,
        workspace_name: tokenData.workspace_name,
        workspace_icon: tokenData.workspace_icon,
        workspace_id: tokenData.workspace_id,
        owner_id: tokenData.owner?.user?.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error("Error saving Notion integration:", upsertError);
      return res.redirect(302, "/settings?error=notion_db_error");
    }

    // Redirect back to settings page with a success message
    return res.redirect(302, "/settings?tab=notion&success=notion_connected");
  } catch (err) {
    console.error("Unexpected error in Notion callback:", err);
    return res.redirect(302, "/settings?error=notion_unexpected_error");
  }
}