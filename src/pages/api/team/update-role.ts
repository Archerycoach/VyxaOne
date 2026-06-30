import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { target_user_id, new_role } = req.body;

    if (!target_user_id || !new_role) {
      return res.status(400).json({ error: "Target user ID and new role are required" });
    }

    // Validate role
    if (!["broker", "team_lead", "consultant"].includes(new_role)) {
      return res.status(400).json({ error: "Invalid role. Must be: broker, team_lead, or consultant" });
    }

    // Verify authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Use the SQL function to update role (it has permission checks)
    const { error: updateError } = await supabaseAdmin.rpc("update_user_role", {
      target_user_id,
      new_role
    });

    if (updateError) {
      console.error("Error updating role:", updateError);
      return res.status(403).json({ error: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: "User role updated successfully"
    });

  } catch (error: any) {
    console.error("Error in update-role handler:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}