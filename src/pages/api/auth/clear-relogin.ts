import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Exigir sessão válida e limpar apenas a flag do PRÓPRIO utilizador — antes
  // aceitava qualquer userId sem autenticação, permitindo a qualquer um
  // limpar o pedido de re-login de outra conta.
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await supabaseAdmin.from("profiles").update({ needs_relogin: false } as any).eq("id", user.id);
  res.status(200).json({ success: true });
}