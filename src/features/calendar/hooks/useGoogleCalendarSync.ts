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
      const hasRefreshToken = !!integration.refresh_token;
      
      // Consider connected if we have a refresh token, even if access token expired
      // The backend will automatically refresh the token when needed
      setIsConnected(hasRefreshToken);
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
        throw new Error("Sessão não encontrada. Por favor, faça login novamente.");
      }

      console.log("[useGoogleCalendarSync] Iniciando sincronização...");

      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("[useGoogleCalendarSync] Erro na sincronização:", result);
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error("Autenticação expirada. Por favor, reconecte sua conta Google.");
        } else if (response.status === 404) {
          throw new Error("Integração Google Calendar não encontrada. Por favor, conecte sua conta primeiro.");
        } else {
          throw new Error(result.error || "Erro desconhecido na sincronização");
        }
      }

      console.log("[useGoogleCalendarSync] Sincronização concluída:", result);

      toast({
        title: "✅ Sincronização concluída",
        description: `${result.synced || 0} eventos sincronizados com sucesso`,
      });

      // Refresh connection status
      await checkConnection();
      
      return result;
    } catch (error) {
      console.error("[useGoogleCalendarSync] Error syncing with Google Calendar:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Não foi possível sincronizar com Google Calendar";
      
      toast({
        title: "❌ Erro na sincronização",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
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
        throw new Error("Falha ao obter configurações");
      }

      const settings = await response.json();
      if (!settings.clientId) {
        throw new Error("Client ID não configurado");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utilizador não autenticado");
      }

      // Build OAuth URL
      const redirectUrl = `${window.location.origin}/api/google-calendar/callback`;
      const scopes = settings.scopes || "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.append("client_id", settings.clientId);
      authUrl.searchParams.append("redirect_uri", redirectUrl);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("scope", scopes);
      authUrl.searchParams.append("access_type", "offline");
      authUrl.searchParams.append("prompt", "consent");
      authUrl.searchParams.append("state", user.id);

      console.log("[useGoogleCalendarSync] Redirecionando para autenticação Google...");

      // Redirect to Google OAuth
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error("[useGoogleCalendarSync] Error connecting to Google:", error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Não foi possível conectar com Google Calendar",
        variant: "destructive",
      });
    }
  }, [isConfigured, toast]);

  const disconnectGoogle = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utilizador não autenticado");
      }

      // Delete the integration
      const { error } = await supabase
        .from("google_calendar_integrations" as any)
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "✅ Desconectado",
        description: "Google Calendar desconectado com sucesso",
      });

      // Refresh connection status
      await checkConnection();
    } catch (error) {
      console.error("[useGoogleCalendarSync] Error disconnecting Google:", error);
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Não foi possível desconectar Google Calendar",
        variant: "destructive",
      });
    }
  }, [toast, checkConnection]);

  return {
    isConnected,
    isSyncing,
    isConfigured,
    loading,
    checkConnection,
    syncWithGoogle,
    connectGoogle,
    disconnectGoogle,
  };
}