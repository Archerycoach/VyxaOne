import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const censorSecret = (secret?: string) => {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Não autorizado" });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) return res.status(401).json({ error: "Token inválido" });

    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return res.status(403).json({ error: "Acesso negado" });

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("key", "payment_config")
        .maybeSingle();

      const config = (data?.value as any) || {
        stripe_enabled: false,
        stripe_public_key: "",
        stripe_secret_key: "",
        eupago_enabled: false,
        eupago_api_key: "",
        mbway_enabled: false,
        test_mode: true,
      };

      const sanitizedConfig = { ...config };
      if (sanitizedConfig.stripe_secret_key) {
        sanitizedConfig.stripe_secret_key = censorSecret(sanitizedConfig.stripe_secret_key);
      }
      if (sanitizedConfig.eupago_api_key) {
        sanitizedConfig.eupago_api_key = censorSecret(sanitizedConfig.eupago_api_key);
      }

      return res.status(200).json(sanitizedConfig);
    }
    
    if (req.method === "POST") {
      const { config } = req.body;
      
      const { data: existing } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("key", "payment_config")
        .maybeSingle();
        
      const existingConfig = (existing?.value as any) || {};
      const newConfig = { ...config };
      
      if (newConfig.stripe_secret_key && newConfig.stripe_secret_key.includes("...")) {
        newConfig.stripe_secret_key = existingConfig.stripe_secret_key;
      }
      if (newConfig.eupago_api_key && newConfig.eupago_api_key.includes("...")) {
        newConfig.eupago_api_key = existingConfig.eupago_api_key;
      }

      const { error } = await supabaseAdmin.from("system_settings").upsert({
        key: "payment_config",
        value: newConfig,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

      if (error) throw error;
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    console.error("API Payment Settings Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}