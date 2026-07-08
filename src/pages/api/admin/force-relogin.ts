import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }

  const { userId, all } = req.body;

  try {
    if (all) {
      // Atualiza todos (exceto null para forçar update em massa no Supabase)
      const { error } = await supabaseAdmin.from("profiles").update({ needs_relogin: true } as any).not("id", "is", null);
      if (error) throw error;
    } else if (userId) {
      const { error } = await supabaseAdmin.from("profiles").update({ needs_relogin: true } as any).eq("id", userId);
      if (error) throw error;
    }
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}