import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  
  await supabaseAdmin.from("profiles").update({ needs_relogin: false } as any).eq("id", userId);
  res.status(200).json({ success: true });
}