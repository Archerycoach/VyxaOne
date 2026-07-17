import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("=== CREATE USER API START ===");
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[API] Missing Supabase credentials");
      return res.status(500).json({
        error: "Configuração do servidor inválida",
        code: "SERVER_CONFIG_ERROR"
      });
    }

    console.log("[API] Supabase URL:", supabaseUrl);
    console.log("[API] Service key exists:", !!supabaseServiceKey);

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the caller's identity from the session token — never trust a
    // client-supplied userId as proof of who is making the request.
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[API] Missing Authorization header");
      return res.status(401).json({
        error: "Não autorizado: sessão em falta",
        code: "NO_TOKEN"
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("[API] Invalid token:", authError?.message);
      return res.status(401).json({
        error: "Não autorizado: sessão inválida",
        code: "INVALID_TOKEN"
      });
    }

    console.log("[API] Validating user:", user.id);

    // Verify caller is admin/broker
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[API] Profile fetch error:", profileError.message);
      return res.status(500).json({
        error: "Erro ao verificar permissões",
        code: "PROFILE_ERROR",
        details: profileError.message
      });
    }

    if (!profile) {
      console.error("[API] User not found:", user.id);
      return res.status(401).json({
        error: "Não autorizado: Utilizador não encontrado",
        code: "USER_NOT_FOUND"
      });
    }

    if (profile.role !== "admin") {
      console.error("[API] User is not admin. Role:", profile.role);
      return res.status(403).json({
        error: "Não autorizado: Requer privilégios de administrador",
        code: "INSUFFICIENT_PERMISSIONS"
      });
    }

    // Fields for the user being created (distinct from the caller's own body-supplied identity above)
    const { email, password, fullName, role, isActive, teamLeadId, emailConfirm } = req.body;

    console.log("[API] Admin verified. Creating user...");

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ 
        error: "Campos obrigatórios em falta: email, password, fullName, role",
        code: "MISSING_FIELDS"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: "Email inválido",
        code: "INVALID_EMAIL"
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        error: "A senha deve ter pelo menos 6 caracteres",
        code: "WEAK_PASSWORD"
      });
    }

    console.log("[API] Creating user:", { email, role, teamLeadId });

    // Create user in Supabase Auth.
    // email_confirm: quando true (default), marca o email como verificado —
    // o utilizador pode iniciar sessão de imediato, sem passar pelo email de
    // confirmação do Supabase. O admin pode desligar no formulário.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: emailConfirm !== false,
      user_metadata: {
        full_name: fullName
      }
    });

    if (createError) {
      console.error("[API] Create user error:", createError.message);
      
      if (createError.message?.includes("already registered")) {
        return res.status(400).json({ 
          error: "Este email já está registado no sistema",
          code: "EMAIL_EXISTS"
        });
      }
      
      return res.status(400).json({ 
        error: createError.message || "Erro ao criar utilizador",
        code: "CREATE_USER_ERROR",
        details: createError.message
      });
    }

    if (!newUser.user) {
      return res.status(500).json({ 
        error: "Falha ao criar utilizador Auth",
        code: "AUTH_CREATE_FAILED"
      });
    }

    console.log("[API] User created in auth:", newUser.user.id);

    // Update profile with role and other details
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        email: email,
        full_name: fullName,
        role: role,
        is_active: isActive !== undefined ? isActive : true,
        team_lead_id: teamLeadId || null,
        updated_at: new Date().toISOString()
      });

    if (profileUpdateError) {
      // O perfil é obrigatório: sem ele o utilizador fica "órfão" (existe em
      // auth.users mas não aparece em lado nenhum). Em vez de reportar sucesso
      // enganador, apagamos o auth.users criado e devolvemos um erro real.
      console.error("[API] Profile update error:", profileUpdateError.message);
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (cleanupErr) {
        console.error("[API] Falha ao limpar auth user órfão:", cleanupErr);
      }
      return res.status(500).json({
        error: "Utilizador não criado: falha ao gravar o perfil (" + profileUpdateError.message + ").",
        code: "PROFILE_CREATE_FAILED",
      });
    }

    console.log("[API] Profile updated successfully");
    console.log("=== CREATE USER API SUCCESS ===");

    return res.status(200).json({ 
      success: true, 
      user: newUser.user,
      message: "Utilizador criado com sucesso"
    });

  } catch (error: any) {
    console.error("=== CREATE USER API ERROR ===");
    console.error("[API] Unexpected error:", error.message);
    console.error("[API] Error stack:", error.stack);
    return res.status(500).json({ 
      error: "Erro interno do servidor: " + error.message,
      code: "INTERNAL_ERROR",
      details: error.stack
    });
  }
}