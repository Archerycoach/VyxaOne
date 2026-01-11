import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("=== SUPABASE ENVIRONMENT TEST ===");
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
    console.log("ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing");
    console.log("SERVICE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing");

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        error: "Missing Supabase credentials",
        details: {
          url: !!supabaseUrl,
          serviceKey: !!supabaseServiceKey
        }
      });
    }

    // Try to create admin client
    console.log("Creating admin client...");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test simple query
    console.log("Testing database connection...");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("count")
      .limit(1);

    if (error) {
      console.error("Database test failed:", error);
      return res.status(500).json({
        error: "Database connection failed",
        details: error
      });
    }

    console.log("✅ All tests passed!");

    return res.status(200).json({
      success: true,
      message: "Supabase connection working correctly",
      tests: {
        environmentVariables: "✅ Present",
        clientCreation: "✅ Success",
        databaseConnection: "✅ Working"
      }
    });

  } catch (error: any) {
    console.error("Test error:", error);
    return res.status(500).json({
      error: "Test failed",
      message: error.message,
      stack: error.stack
    });
  }
}