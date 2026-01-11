import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { code, state: userId, error: oauthError } = req.query;

    console.log("[Google Calendar Callback] ========== INÍCIO ==========");
    console.log("[Google Calendar Callback] Request received:", {
      hasCode: !!code,
      codeLength: code ? (code as string).length : 0,
      hasUserId: !!userId,
      userId: userId,
      hasError: !!oauthError,
      error: oauthError,
      fullQuery: req.query
    });

    // Check if user denied authorization
    if (oauthError) {
      console.error("[Google Calendar Callback] OAuth error from Google:", oauthError);
      return res.redirect(302, "/calendar?error=authorization_denied");
    }

    if (!code || !userId || typeof userId !== "string") {
      console.error("[Google Calendar Callback] Missing required parameters:", { 
        code: !!code, 
        userId,
        userIdType: typeof userId
      });
      return res.redirect(302, "/calendar?error=invalid_params");
    }

    console.log("[Google Calendar Callback] Step 1: Fetching OAuth settings from database...");

    // Get OAuth settings from database
    const { data: integrationSettings, error: settingsError } = await supabaseAdmin
      .from("integration_settings" as any)
      .select("*")
      .eq("service_name", "google_calendar")
      .single();

    if (settingsError) {
      console.error("[Google Calendar Callback] Database error fetching settings:", {
        error: settingsError,
        message: settingsError.message,
        code: settingsError.code,
        details: settingsError.details
      });
      return res.redirect(302, "/calendar?error=db_settings_error");
    }

    if (!integrationSettings) {
      console.error("[Google Calendar Callback] No integration settings found in database");
      return res.redirect(302, "/calendar?error=config_not_found");
    }

    console.log("[Google Calendar Callback] Step 2: Settings retrieved successfully");

    const settings = integrationSettings as any;
    const { client_id, client_secret, redirect_uri } = settings;

    if (!client_id || !client_secret) {
      console.error("[Google Calendar Callback] Missing OAuth credentials:", {
        hasClientId: !!client_id,
        hasClientSecret: !!client_secret
      });
      return res.redirect(302, "/calendar?error=missing_credentials");
    }

    const actualRedirectUri = redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt"}/api/google-calendar/callback`;

    console.log("[Google Calendar Callback] Step 3: Using OAuth credentials:", {
      redirect_uri: actualRedirectUri,
      client_id: client_id.substring(0, 20) + "...",
      hasClientSecret: !!client_secret
    });

    // Exchange code for tokens
    const tokenRequestBody = {
      code: code as string,
      client_id: client_id,
      client_secret: client_secret,
      redirect_uri: actualRedirectUri,
      grant_type: "authorization_code",
    };

    console.log("[Google Calendar Callback] Step 4: Exchanging code for tokens...");
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(tokenRequestBody),
    });

    console.log("[Google Calendar Callback] Step 5: Token response received:", {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      ok: tokenResponse.ok
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Google Calendar Callback] Token exchange failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        requestBody: {
          ...tokenRequestBody,
          client_secret: "***HIDDEN***",
          code: code ? (code as string).substring(0, 10) + "..." : "none"
        }
      });
      return res.redirect(302, `/calendar?error=token_exchange&status=${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log("[Google Calendar Callback] Step 6: Tokens parsed successfully:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    // Get user info
    console.log("[Google Calendar Callback] Step 7: Fetching user info from Google...");
    
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.log("[Google Calendar Callback] Step 8: User info response received:", {
      status: userInfoResponse.status,
      statusText: userInfoResponse.statusText,
      ok: userInfoResponse.ok
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error("[Google Calendar Callback] User info request failed:", {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        error: errorText
      });
      return res.redirect(302, "/calendar?error=user_info_failed");
    }

    const userInfo = await userInfoResponse.json();
    console.log("[Google Calendar Callback] Step 9: User info parsed successfully:", { 
      email: userInfo.email,
      verified_email: userInfo.verified_email,
      hasName: !!userInfo.name
    });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    console.log("[Google Calendar Callback] Step 10: Saving integration to database...");

    // Save or update integration in database
    const { error: upsertError, data: upsertData } = await supabaseAdmin
      .from("google_calendar_integrations" as any)
      .upsert({
        user_id: userId,
        google_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        sync_events: true,
        sync_tasks: true,
        sync_notes: false,
        sync_direction: "both",
        auto_sync: true,
      }, {
        onConflict: "user_id",
      })
      .select();

    if (upsertError) {
      console.error("[Google Calendar Callback] Database upsert error:", {
        error: upsertError,
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint
      });
      return res.redirect(302, "/calendar?error=save_failed");
    }

    console.log("[Google Calendar Callback] Step 11: Integration saved successfully:", {
      recordId: (upsertData as any)?.[0]?.id,
      userId: userId
    });

    console.log("[Google Calendar Callback] ========== SUCESSO ==========");

    // Redirect to calendar with success flag to trigger sync
    res.redirect(302, "/calendar?connected=true&sync=true");
  } catch (error) {
    console.error("[Google Calendar Callback] ========== ERRO CRÍTICO ==========");
    console.error("[Google Calendar Callback] Unexpected error:", {
      error: error,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    const errorMessage = error instanceof Error ? error.message : "unknown";
    res.redirect(302, `/calendar?error=unexpected&details=${encodeURIComponent(errorMessage)}`);
  }
}