import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { triggerManualSync } from "@/lib/googleCalendar";

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
        setIsConfigured(!!(settings.enabled && settings.clientId && settings.clientSecret));
      }
    } catch (error) {
      console.error("Error checking Google Calendar configuration:", error);
      setIsConfigured(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        setSyncSettings(null);
        return;
      }

      const { data, error } = await supabase
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setIsConnected(false);
        setSyncSettings(null);
        return;
      }

      // Check if token is still valid
      const integration = data as any;
      const hasRefreshToken = !!integration.refresh_token;
      
      // Store sync settings
      setSyncSettings({
        syncDirection: integration.sync_direction,
        syncEvents: integration.sync_events,
        syncTasks: integration.sync_tasks,
      });
      
      // Consider connected if we have a refresh token, even if access token expired
      // The backend will automatically refresh the token when needed
      setIsConnected(hasRefreshToken);
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

      // Get OAuth settings from database
      const { data: settings } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .eq("service_name", "google_calendar")
        .single();

      if (!settings) {
        toast({
          title: "⚙️ Configuração não encontrada",
          description: "Por favor, configure o Google Calendar nas definições de integração",
          variant: "destructive",
        });
        return;
      }

      const settingsData = settings as any;
      const { client_id, redirect_uri } = settingsData;
      const actualRedirectUri = redirect_uri || `${window.location.origin}/api/google-calendar/callback`;

      const scope = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: client_id,
        redirect_uri: actualRedirectUri,
        response_type: "code",
        scope: scope,
        access_type: "offline",
        prompt: "consent",
        state: user.id,
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