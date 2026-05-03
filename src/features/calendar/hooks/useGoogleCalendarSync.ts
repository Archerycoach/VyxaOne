import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { triggerManualSync } from "@/lib/googleCalendar";

const REQUIRED_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

function buildGoogleScopeString(scopes: unknown) {
  const configuredScopes = Array.isArray(scopes)
    ? scopes.filter((scope): scope is string => typeof scope === "string" && scope.trim().length > 0)
    : typeof scopes === "string"
      ? scopes.split(/\s+/).filter(Boolean)
      : [];

  return Array.from(new Set([...configuredScopes, ...REQUIRED_GOOGLE_SCOPES])).join(" ");
}

export function useGoogleCalendarSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncSettings, setSyncSettings] = useState<{
    syncDirection: string | null;
    syncEvents: boolean;
    syncTasks: boolean;
  } | null>(null);
  const { toast } = useToast();

  const checkConfiguration = useCallback(async () => {
    try {
      const response = await fetch("/api/google-calendar/settings");
      if (response.ok) {
        const settings = await response.json();
        // Apenas exigir o clientId para considerar como configurado
        setIsConfigured(!!settings.clientId);
      }
    } catch (error) {
      console.error("Error checking Google Calendar configuration:", error);
      setIsConfigured(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      console.log("[useGoogleCalendarSync] Verificando conexão...");
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("[useGoogleCalendarSync] Erro de user:", userError);
        setIsConnected(false);
        setSyncSettings(null);
        return;
      }

      console.log("[useGoogleCalendarSync] User id atual:", user.id);

      const { data, error } = await supabase
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log("[useGoogleCalendarSync] Resposta BD integração:", { data: data ? "Existe" : "Nulo", error });

      if (error || !data) {
        console.log("[useGoogleCalendarSync] Sem integração encontrada ou erro de leitura");
        setIsConnected(false);
        setSyncSettings(null);
        return;
      }

      // Check if token is still valid
      const integration = data as any;
      console.log("[useGoogleCalendarSync] Integração encontrada, validando...", { sync_direction: integration.sync_direction });
      
      // Store sync settings
      setSyncSettings({
        syncDirection: integration.sync_direction,
        syncEvents: integration.sync_events,
        syncTasks: integration.sync_tasks,
      });
      
      // Se o registo existe, o utilizador está conectado
      setIsConnected(true);
    } catch (error) {
      console.error("Error checking Google Calendar connection:", error);
      setIsConnected(false);
      setSyncSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConfiguration();
    checkConnection();
  }, [checkConfiguration, checkConnection]);

  const syncWithGoogle = useCallback(async () => {
    if (!isConfigured) {
      toast({
        title: "⚙️ Configuração necessária",
        description: "A integração com Google Calendar precisa ser configurada por um administrador",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "🔌 Conexão necessária",
        description: "Você precisa conectar sua conta Google primeiro",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSyncing(true);
      
      console.log("[useGoogleCalendarSync] 🔄 Iniciando sincronização manual...");
      console.log("[useGoogleCalendarSync] 📋 Configurações:", syncSettings);

      // Use the same function that automatic sync uses (it's working!)
      const result = await triggerManualSync();

      if (!result.success) {
        console.error("[useGoogleCalendarSync] ❌ Erro na sincronização:", result.error);
        throw new Error(result.error || "Erro desconhecido na sincronização");
      }

      console.log("[useGoogleCalendarSync] ✅ Sincronização concluída:", result);

      // Create detailed success message
      const syncedCount = result.synced || 0;
      let syncDescription = `${syncedCount} item(s) sincronizado(s)`;
      
      if (syncSettings) {
        const directions = [];
        if (syncSettings.syncDirection === "both") {
          directions.push("↕️ Bidirecional");
        } else if (syncSettings.syncDirection === "fromGoogle") {
          directions.push("📥 Do Google");
        } else if (syncSettings.syncDirection === "toGoogle") {
          directions.push("📤 Para o Google");
        }
        
        const types = [];
        if (syncSettings.syncEvents) types.push("Eventos");
        if (syncSettings.syncTasks) types.push("Tarefas");
        
        if (directions.length > 0 || types.length > 0) {
          syncDescription += "\n";
          if (directions.length > 0) syncDescription += directions.join(", ");
          if (types.length > 0) syncDescription += ` (${types.join(", ")})`;
        }
      }

      toast({
        title: "✅ Sincronização concluída",
        description: syncDescription,
        duration: 5000,
      });

      // Refresh connection status
      await checkConnection();
      
      return result;
    } catch (error) {
      console.error("[useGoogleCalendarSync] ❌ Error syncing with Google Calendar:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Não foi possível sincronizar com Google Calendar";
      
      toast({
        title: "❌ Erro na sincronização",
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      });
      
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured, isConnected, syncSettings, toast, checkConnection]);

  const connectGoogle = useCallback(async () => {
    try {
      console.log("[useGoogleCalendarSync] 🔗 Initiating Google OAuth flow...");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Get OAuth settings from API instead of direct DB query to avoid RLS and schema issues
      const response = await fetch("/api/google-calendar/settings");
      if (!response.ok) {
        throw new Error("Falha ao obter configurações do servidor");
      }
      
      const settings = await response.json();

      if (!settings || !settings.clientId) {
        toast({
          title: "⚙️ Configuração não encontrada",
          description: "Por favor, configure o Google Calendar nas definições de integração",
          variant: "destructive",
        });
        return;
      }

      const actualRedirectUri = window.location.origin.includes('localhost') || window.location.origin.includes('softgen') 
        ? `${window.location.origin}/api/google-calendar/callback`
        : (settings.redirectUri || `${window.location.origin}/api/google-calendar/callback`);

      const scopeString = buildGoogleScopeString(settings.scopes);

      // Codificar o estado para enviar o ID e o URL de redirecionamento de forma segura
      const stateObj = {
        userId: user.id,
        redirectUri: actualRedirectUri
      };
      const encodedState = window.btoa(JSON.stringify(stateObj));

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: settings.clientId,
        redirect_uri: actualRedirectUri,
        response_type: "code",
        scope: scopeString,
        access_type: "offline",
        prompt: "consent",
        state: encodedState,
      })}`;

      console.log("[useGoogleCalendarSync] 🌐 Redirecting to Google OAuth...");
      window.location.href = authUrl;
    } catch (error) {
      console.error("[useGoogleCalendarSync] ❌ Error connecting to Google:", error);
      toast({
        title: "❌ Erro ao conectar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [toast]);

  const disconnectGoogle = useCallback(async () => {
    try {
      console.log("[useGoogleCalendarSync] 🔌 Disconnecting Google Calendar...");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase
        .from("google_calendar_integrations" as any)
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setIsConnected(false);
      setSyncSettings(null);
      
      toast({
        title: "✅ Desconectado",
        description: "Google Calendar desconectado com sucesso",
      });

      console.log("[useGoogleCalendarSync] ✅ Successfully disconnected");
    } catch (error) {
      console.error("[useGoogleCalendarSync] ❌ Error disconnecting:", error);
      toast({
        title: "❌ Erro ao desconectar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    isConnected,
    isSyncing,
    isConfigured,
    loading,
    syncSettings,
    checkConnection,
    syncWithGoogle,
    connectGoogle,
    disconnectGoogle,
  };
}