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
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error("OAuth error:", oauthError);
      return res.redirect("/settings?meta_error=access_denied");
    }

    if (!code || !state) {
      return res.redirect("/settings?meta_error=invalid_request");
    }

    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state as string, "base64").toString());

    // Get Meta app settings
    const { data: settings } = await supabase
      .from("meta_app_settings")
      .select("*")
      .single();

    if (!settings) {
      return res.redirect("/settings?meta_error=not_configured");
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${settings.app_id}` +
      `&client_secret=${settings.app_secret}` +
      `&redirect_uri=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt"}/api/meta/callback`)}` +
      `&code=${code}`
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return res.redirect("/settings?meta_error=token_exchange_failed");
    }

    // Exchange for long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${settings.app_id}` +
      `&client_secret=${settings.app_secret}` +
      `&fb_exchange_token=${tokenData.access_token}`
    );

    const longLivedData = await longLivedResponse.json();
    const userAccessToken = longLivedData.access_token || tokenData.access_token;

    // Get user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`
    );

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    // Save each page as a separate integration
    for (const page of pages) {
      // Subscribe page to webhooks
      const subscribeResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: page.access_token,
            subscribed_fields: ["leadgen"],
          }),
        }
      );

      const subscribeData = await subscribeResponse.json();
      const webhookSubscribed = subscribeData.success === true;

      // Calculate token expiration (60 days for long-lived tokens)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      // Save integration
      await supabase
        .from("meta_integrations")
        .upsert({
          user_id: userId,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          webhook_subscribed: webhookSubscribed,
        }, {
          onConflict: "user_id,page_id"
        });
    }

    return res.redirect("/settings?meta_success=true");
  } catch (error) {
    console.error("Error in Meta callback:", error);
    return res.redirect("/settings?meta_error=server_error");
  }
}