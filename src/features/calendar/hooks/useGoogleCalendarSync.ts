import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useGoogleCalendarSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
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
        return;
      }

      const { data, error } = await supabase
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setIsConnected(false);
        return;
      }

      // Check if token is still valid
      const integration = data as any;
      const expiresAt = integration.expires_at;
      const isValid = expiresAt && new Date(expiresAt) > new Date();
      setIsConnected(!!isValid);
    } catch (error) {
      console.error("Error checking Google Calendar connection:", error);
      setIsConnected(false);
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
        title: "Configuração necessária",
        description: "A integração com Google Calendar precisa ser configurada por um administrador",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Conexão necessária",
        description: "Você precisa conectar sua conta Google primeiro",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSyncing(true);
      
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const result = await response.json();

      toast({
        title: "Sincronização concluída",
        description: `${result.synced || 0} items sincronizados com sucesso`,
      });

      // Refresh connection status
      await checkConnection();
    } catch (error) {
      console.error("Error syncing with Google Calendar:", error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar com Google Calendar",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured, isConnected, toast, checkConnection]);

  const connectGoogle = useCallback(async () => {
    if (!isConfigured) {
      toast({
        title: "Configuração necessária",
        description: "A integração com Google Calendar precisa ser configurada por um administrador em Administração → Integrações",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get settings to build auth URL
      const response = await fetch("/api/google-calendar/settings");
      if (!response.ok) {
        throw new Error("Failed to get settings");
      }

      const settings = await response.json();
      if (!settings.clientId) {
        throw new Error("Client ID not configured");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Build OAuth URL
      const redirectUrl = `${window.location.origin}/api/google-calendar/callback`;
      const scopes = settings.scopes || "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.append("client_id", settings.clientId);
      authUrl.searchParams.append("redirect_uri", redirectUrl);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("scope", scopes);
      authUrl.searchParams.append("access_type", "offline");
      authUrl.searchParams.append("prompt", "consent");
      authUrl.searchParams.append("state", user.id);

      // Redirect to Google OAuth
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error("Error connecting to Google:", error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Não foi possível conectar com Google Calendar",
        variant: "destructive",
      });
    }
  }, [isConfigured, toast]);

  return {
    isConnected,
    isSyncing,
    isConfigured,
    loading,
    checkConnection,
    syncWithGoogle,
    connectGoogle,
  };
}