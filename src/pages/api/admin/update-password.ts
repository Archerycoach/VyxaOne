import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Alteração manual da password de um utilizador pelo ADMIN.
 *
 * Segurança (mesmo padrão do create-user.ts):
 * - identidade do chamador validada pelo token de sessão (nunca pelo body);
 * - só perfis com role "admin" podem usar;
 * - a alteração é feita com a service role via auth.admin.updateUserById.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Configuração do servidor inválida", code: "SERVER_CONFIG_ERROR" });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Identidade do chamador a partir do token de sessão
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autorizado: sessão em falta", code: "NO_TOKEN" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Não autorizado: sessão inválida", code: "INVALID_TOKEN" });
    }

    // Só admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return res.status(403).json({
        error: "Não autorizado: Requer privilégios de administrador",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };

    if (!userId || !newPassword) {
      return res.status(400).json({ error: "Campos obrigatórios em falta: userId, newPassword", code: "MISSING_FIELDS" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A password deve ter pelo menos 6 caracteres", code: "WEAK_PASSWORD" });
    }

    // Confirmar que o utilizador alvo existe nesta instância
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProfile) {
      return res.status(404).json({ error: "Utilizador não encontrado", code: "USER_NOT_FOUND" });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("[Admin Update Password] Erro:", updateError.message);
      return res.status(400).json({
        error: updateError.message || "Erro ao alterar a password",
        code: "UPDATE_PASSWORD_ERROR",
      });
    }

    console.log(`[Admin Update Password] Password de ${targetProfile.email} alterada pelo admin ${user.id}`);

    return res.status(200).json({
      success: true,
      message: `Password de ${targetProfile.full_name || targetProfile.email} alterada com sucesso`,
    });
  } catch (error: any) {
    console.error("[Admin Update Password] Erro inesperado:", error);
    return res.status(500).json({ error: "Erro interno do servidor: " + error.message, code: "INTERNAL_ERROR" });
  }
}
