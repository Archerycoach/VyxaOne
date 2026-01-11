import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("[DELETE USER API] ========================================");
  console.log("[DELETE USER API] Starting user deletion process");
  console.log("[DELETE USER API] Service key exists:", !!supabaseServiceKey);
  console.log("[DELETE USER API] Service key length:", supabaseServiceKey?.length || 0);

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[DELETE USER API] No authorization header");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Verify admin user
    console.log("[DELETE USER API] Verifying admin user...");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log("[DELETE USER API] Failed to verify user:", userError?.message);
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("[DELETE USER API] Current user ID:", user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      console.log("[DELETE USER API] User is not admin");
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const { userId } = req.body;
    if (!userId) {
      console.log("[DELETE USER API] No userId provided");
      return res.status(400).json({ error: "userId is required" });
    }

    console.log("[DELETE USER API] Target user ID:", userId);

    if (userId === user.id) {
      console.log("[DELETE USER API] Cannot delete own account");
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // ============================================================
    // STEP 1: Delete from child tables (with CASCADE handling)
    // ============================================================
    console.log("[DELETE USER API] ========================================");
    console.log("[DELETE USER API] STEP 1: Deleting from child tables...");
    
    const tables = [
      "lead_workflow_rules",
      "workflow_templates",
      "lead_interactions",
      "calendar_events",
      "tasks",
      "notifications",
      "whatsapp_templates",
      "whatsapp_messages",
      "contacts",
      "properties",
      "leads",
      "subscriptions",
      "profiles"
    ];

    for (const table of tables) {
      try {
        console.log(`[DELETE USER API] Deleting from ${table}...`);
        const { error: deleteError, count } = await supabase
          .from(table)
          .delete()
          .eq("user_id", userId);

        if (deleteError) {
          console.log(`[DELETE USER API] Error deleting from ${table}:`, deleteError.message);
        } else {
          console.log(`[DELETE USER API] ✓ Deleted ${count || 0} records from ${table}`);
        }
      } catch (err: any) {
        console.log(`[DELETE USER API] Exception deleting from ${table}:`, err?.message || err);
      }
    }

    console.log("[DELETE USER API] ✓ Child tables cleanup completed");

    // ============================================================
    // STEP 2: Delete from auth.users (MULTIPLE STRATEGIES)
    // ============================================================
    console.log("[DELETE USER API] ========================================");
    console.log("[DELETE USER API] STEP 2: Deleting user from auth.users...");

    // Strategy 1: Try Supabase Admin SDK
    console.log("[DELETE USER API] Strategy 1: Using Supabase Admin SDK...");
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { error: sdkError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (!sdkError) {
      console.log("[DELETE USER API] ✓✓✓ SUCCESS via Admin SDK!");
      return res.status(200).json({
        success: true,
        message: "User deleted successfully via Admin SDK",
        method: "sdk"
      });
    }

    console.log("[DELETE USER API] ✗ Admin SDK failed:", sdkError.message);
    console.log("[DELETE USER API] Error code:", (sdkError as any).code);
    console.log("[DELETE USER API] Error status:", sdkError.status);

    // Strategy 2: Try direct HTTP to Supabase Management API
    console.log("[DELETE USER API] ========================================");
    console.log("[DELETE USER API] Strategy 2: Using Management API (direct HTTP)...");
    
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) {
      console.log("[DELETE USER API] ✗ Could not extract project ref from URL");
    } else {
      console.log("[DELETE USER API] Project ref:", projectRef);
      console.log("[DELETE USER API] Calling DELETE /auth/v1/admin/users/{userId}...");
      
      try {
        const httpResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
            "Content-Type": "application/json"
          }
        });

        console.log("[DELETE USER API] HTTP Response status:", httpResponse.status);
        const httpBody = await httpResponse.text();
        console.log("[DELETE USER API] HTTP Response body:", httpBody);

        if (httpResponse.ok || httpResponse.status === 204) {
          console.log("[DELETE USER API] ✓✓✓ SUCCESS via Management API!");
          return res.status(200).json({
            success: true,
            message: "User deleted successfully via Management API",
            method: "http"
          });
        }

        console.log("[DELETE USER API] ✗ Management API failed");
      } catch (httpError: any) {
        console.log("[DELETE USER API] ✗ Management API exception:", httpError.message);
      }
    }

    // Strategy 3: Try SQL direct delete (NUCLEAR OPTION)
    console.log("[DELETE USER API] ========================================");
    console.log("[DELETE USER API] Strategy 3: Using SQL direct delete (NUCLEAR)...");
    
    try {
      const { error: sqlError } = await supabase.rpc("exec_sql", {
        sql: `DELETE FROM auth.users WHERE id = '${userId}'::uuid;`
      });

      if (!sqlError) {
        console.log("[DELETE USER API] ✓✓✓ SUCCESS via SQL direct!");
        return res.status(200).json({
          success: true,
          message: "User deleted successfully via SQL",
          method: "sql"
        });
      }

      console.log("[DELETE USER API] ✗ SQL direct failed:", sqlError.message);
    } catch (sqlException: any) {
      console.log("[DELETE USER API] ✗ SQL direct exception:", sqlException.message);
    }

    // ============================================================
    // ALL STRATEGIES FAILED
    // ============================================================
    console.log("[DELETE USER API] ========================================");
    console.log("[DELETE USER API] ✗✗✗ ALL STRATEGIES FAILED");
    console.log("[DELETE USER API] This might be a Supabase platform issue");
    console.log("[DELETE USER API] Recommendation: Try deleting via Supabase Dashboard");
    
    return res.status(500).json({
      error: "Failed to delete user from authentication",
      details: "All deletion strategies failed. This might be a Supabase platform issue.",
      attemptedMethods: ["sdk", "http", "sql"],
      recommendation: "Try deleting the user directly from your Supabase Dashboard (Authentication > Users)",
      sdkError: {
        message: sdkError.message,
        code: (sdkError as any).code,
        status: sdkError.status
      }
    });

  } catch (error: any) {
    console.error("[DELETE USER API] ========================================");
    console.error("[DELETE USER API] UNEXPECTED ERROR:", error);
    console.error("[DELETE USER API] Error message:", error?.message);
    console.error("[DELETE USER API] Error stack:", error?.stack);
    
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
      errorType: error.constructor.name
    });
  }
}