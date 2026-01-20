import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get user from session
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get Meta app settings
    const { data: settings } = await supabase
      .from("meta_app_settings")
      .select("app_id, is_active")
      .single();

    if (!settings?.is_active) {
      return res.status(400).json({ error: "Meta integration not configured" });
    }

    // Build OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt"}/api/meta/callback`;
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64");

    const authUrl = 
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${settings.app_id}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=leads_retrieval,pages_manage_ads,pages_read_engagement` +
      `&state=${state}`;

    return res.status(200).json({ authUrl });
  } catch (error) {
    console.error("Error in Meta auth:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}