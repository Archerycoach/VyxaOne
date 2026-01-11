import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import { supabase } from "@/integrations/supabase/client";

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    // Execute server restart command
    const { stdout, stderr } = await execAsync("pm2 restart all");

    if (stderr && !stderr.includes("successfully")) {
      console.error("Restart error:", stderr);
      return res.status(500).json({ 
        error: "Failed to restart server",
        details: stderr 
      });
    }

    return res.status(200).json({ 
      success: true,
      message: "Servidor reiniciado com sucesso",
      output: stdout
    });

  } catch (error) {
    console.error("Server restart error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}