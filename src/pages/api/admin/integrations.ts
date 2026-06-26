import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Função para censurar chaves visualmente
const censorSecret = (secret?: string) => {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas aceita GET, POST e DELETE
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Verificar Autenticação do Administrador
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Não autorizado: Header ausente" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: "Não autorizado: Token inválido" });
    }

    // Verificar se é Admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado: Apenas administradores" });
    }

    // 2. Método GET: Devolver configurações com segredos censurados
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin.from("integration_settings").select("*");
      if (error) throw error;

      const sanitizedData = data.map((item) => {
        const settings = (item.settings as any) || {};
        const sanitizedSettings = { ...settings };
        
        // Censurar chaves conhecidas
        if (sanitizedSettings.client_secret) sanitizedSettings.client_secret = censorSecret(sanitizedSettings.client_secret);
        if (sanitizedSettings.access_token) sanitizedSettings.access_token = censorSecret(sanitizedSettings.access_token);
        
        return { ...item, settings: sanitizedSettings };
      });

      return res.status(200).json(sanitizedData);
    }
    
    // 3. Método POST: Atualizar configurações
    if (req.method === "POST") {
      const { integration_name, settings, is_active } = req.body;
      
      if (!integration_name) {
        return res.status(400).json({ error: "Nome da integração em falta" });
      }
      
      // Buscar configuração existente para não apagar chaves censuradas
      const { data: existing } = await supabaseAdmin
        .from("integration_settings")
        .select("settings")
        .eq("integration_name", integration_name)
        .maybeSingle();
        
      const existingSettings = (existing?.settings as any) || {};
      const newSettings = { ...settings };
      
      // Se a chave recebida incluir "..." ou "••••", preservamos a original
      if (newSettings.client_secret && (newSettings.client_secret.includes("...") || newSettings.client_secret.includes("••••"))) {
        newSettings.client_secret = existingSettings.client_secret;
      }
      if (newSettings.access_token && (newSettings.access_token.includes("...") || newSettings.access_token.includes("••••"))) {
        newSettings.access_token = existingSettings.access_token;
      }

      const { error } = await supabaseAdmin.from("integration_settings").upsert({
        integration_name,
        settings: newSettings,
        is_active,
        updated_at: new Date().toISOString()
      }, { onConflict: "integration_name" });

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 4. Método DELETE: Limpar configuração
    if (req.method === "DELETE") {
      const { integration_name } = req.body;
      if (!integration_name) {
        return res.status(400).json({ error: "Nome da integração em falta" });
      }

      const { error } = await supabaseAdmin
        .from("integration_settings")
        .delete()
        .eq("integration_name", integration_name);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

  } catch (error: any) {
    console.error("API Integrations Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}