import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// List of known secret keys that should be masked in GET responses
const SECRET_KEYS = [
  'idealista_rapidapi_key',
  'stripe_secret_key',
  'openai_api_key',
  'deepseek_api_key',
  'anthropic_api_key',
  'google_api_key',
  'meta_app_secret',
  'smtp_password',
  'eupago_api_key',
  'notion_api_key',
];

/**
 * Masks secret values - shows first 8 + last 4 characters
 */
function maskSecret(value: string): string {
  if (!value || value.length <= 12) return "••••••••";
  return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
}

/**
 * Checks if a key is a known secret
 */
function isSecretKey(key: string): boolean {
  return SECRET_KEYS.includes(key);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verify authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.error("[system-settings] Missing authorization token");
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error("[system-settings] Invalid token:", authError);
      return res.status(401).json({ error: "Token inválido" });
    }

    // Verify admin role (only admin and broker can manage system settings)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[system-settings] Profile fetch error:", profileError);
      return res.status(500).json({ error: "Erro ao verificar permissões" });
    }

    if (!profile || (profile.role !== "admin" && profile.role !== "broker")) {
      console.error("[system-settings] Access denied for role:", profile?.role);
      return res.status(403).json({ error: "Acesso negado. Apenas admin/broker." });
    }

    // GET: Return configuration (with secrets masked)
    if (req.method === "GET") {
      const keysParam = req.query.keys as string;
      
      if (!keysParam) {
        return res.status(400).json({ error: "Parâmetro 'keys' obrigatório (ex: ?keys=key1,key2,key3)" });
      }

      // Parse comma-separated keys
      const requestedKeys = keysParam.split(',').map(k => k.trim()).filter(Boolean);
      
      if (requestedKeys.length === 0) {
        return res.status(400).json({ error: "Lista de chaves vazia" });
      }

      // Fetch requested settings
      const { data: settings, error: fetchError } = await supabaseAdmin
        .from("system_settings")
        .select("key, value")
        .in("key", requestedKeys);

      if (fetchError) {
        console.error("[system-settings] Fetch error:", fetchError);
        return res.status(500).json({ error: "Erro ao buscar configurações" });
      }

      // Build response object with masking for secrets
      const response: Record<string, any> = {};
      
      for (const key of requestedKeys) {
        const setting = (settings || []).find(s => s.key === key);
        const value = setting?.value || "";
        
        // Mask if secret, otherwise return as-is
        response[key] = isSecretKey(key) ? maskSecret(value as string) : value;
        
        // For secrets, also add a "_configured" boolean
        if (isSecretKey(key)) {
          response[`${key}_configured`] = !!value;
        }
      }

      return res.status(200).json(response);
    }

    // POST: Update system settings (admin/broker only)
    if (req.method === "POST") {
      const body = req.body;

      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Body inválido" });
      }

      const updates = Object.entries(body);
      
      if (updates.length === 0) {
        return res.status(400).json({ error: "Nenhuma configuração para atualizar" });
      }

      // Upsert each setting using service-role
      for (const [key, value] of updates) {
        await supabaseAdmin
          .from("system_settings")
          .upsert({
            key,
            value: value as string,
            updated_at: new Date().toISOString()
          }, { onConflict: "key" });
      }

      // Log activity
      const changedKeys = updates.map(([key]) => key).join(", ");
      await supabaseAdmin.from("activity_logs").insert({
        user_id: user.id,
        action: "update_system_settings",
        entity_type: "system_settings",
        entity_id: null,
        details: { 
          keys: updates.map(([key]) => key),
          by: profile.full_name || user.email
        }
      });

      console.log(`[system-settings] Updated by ${profile.full_name}: ${changedKeys}`);

      return res.status(200).json({ 
        success: true, 
        message: "Configurações guardadas com sucesso",
        updated_keys: updates.map(([key]) => key)
      });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (error: any) {
    console.error("[system-settings] Unexpected error:", error);
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}