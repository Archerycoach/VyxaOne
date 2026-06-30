import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Database } from "@/integrations/supabase/database.types";

type IntegrationSettingsInsert = Database["public"]["Tables"]["integration_settings"]["Insert"];

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
      console.error("Integration settings: Missing authorization header");
      return res.status(401).json({ error: "Não autorizado: Header ausente" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Integration settings: Invalid token", authError);
      return res.status(401).json({ error: "Não autorizado: Token inválido" });
    }

    // Verificar se é Admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Integration settings: Profile fetch error", profileError);
      return res.status(500).json({ error: "Erro ao verificar permissões" });
    }

    if (profile?.role !== "admin" && profile?.role !== "broker") {
      console.error("Integration settings: User is not admin/broker", profile?.role);
      return res.status(403).json({ error: "Acesso negado: Apenas administradores" });
    }

    // 2. Método GET: Devolver configurações com segredos censurados
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin.from("integration_settings").select("*");
      
      if (error) {
        console.error("Integration settings: Database error on GET", error);
        throw error;
      }

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
      
      // Buscar configuração existente para não apagar chaves censuradas.
      // Lemos tanto o settings como as colunas, porque o secret "verdadeiro"
      // pode estar na coluna (não no settings).
      const { data: existing } = await supabaseAdmin
        .from("integration_settings")
        .select("settings, client_secret")
        .eq("integration_name", integration_name)
        .maybeSingle();
        
      const existingSettings = ((existing as any)?.settings as any) || {};
      const existingColumnSecret = (existing as any)?.client_secret || "";
      const newSettings = { ...settings };
      
      // Se a chave recebida vier censurada ("..." ou "••••"), preservamos a
      // original — preferindo a coluna, e caindo para o settings se necessário.
      if (newSettings.client_secret && (newSettings.client_secret.includes("...") || newSettings.client_secret.includes("••••"))) {
        newSettings.client_secret = existingColumnSecret || existingSettings.client_secret;
      }
      if (newSettings.access_token && (newSettings.access_token.includes("...") || newSettings.access_token.includes("••••"))) {
        newSettings.access_token = existingSettings.access_token;
      }

      // IMPORTANTE: o resto da aplicação (callback OAuth, sincronização) lê as
      // credenciais das COLUNAS (client_id, client_secret, redirect_uri, scopes,
      // enabled), não de dentro do campo settings. Por isso gravamos nos dois
      // sítios: nas colunas (fonte de verdade lida pelo código) e em settings
      // (para o ecrã de administração continuar a mostrar). Sem isto, guardar
      // pela interface não tinha efeito real na ligação ao Google.
      const row: IntegrationSettingsInsert = {
        integration_name,
        settings: newSettings,
        is_active,
        updated_at: new Date().toISOString(),
      };

      // Mapear os campos conhecidos do settings para as colunas dedicadas.
      if (newSettings.client_id !== undefined) row.client_id = newSettings.client_id;
      if (newSettings.client_secret !== undefined) row.client_secret = newSettings.client_secret;
      if (newSettings.redirect_uri !== undefined) row.redirect_uri = newSettings.redirect_uri;
      if (newSettings.scopes !== undefined) row.scopes = newSettings.scopes;
      // O ecrã usa is_active como o interruptor de ligado/desligado; manter a
      // coluna enabled em sincronia, que é a que o calendário e a sync verificam.
      row.enabled = is_active;

      const { error } = await supabaseAdmin.from("integration_settings").upsert(
        row,
        { onConflict: "integration_name" }
      );

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