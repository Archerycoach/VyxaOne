import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Facebook, Trash2, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { getUserMetaIntegrations, deleteMetaIntegration, type MetaIntegration } from "@/services/metaService";

interface MetaAccountConnectionProps {
  onSelectIntegration?: (integration: { id: string; name: string }) => void;
}

export function MetaAccountConnection({ onSelectIntegration }: MetaAccountConnectionProps) {
  const [integrations, setIntegrations] = useState<MetaIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadIntegrations();
    
    // Check for URL params indicating status
    const params = new URLSearchParams(window.location.search);
    const metaSuccess = params.get("meta_success");
    const metaError = params.get("meta_error");
    
    if (metaSuccess === "true") {
      toast({
        title: "Sucesso!",
        description: "Conta Meta conectada com sucesso.",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (metaError) {
      toast({
        title: "Erro na conexão",
        description: "Não foi possível conectar a conta Meta. Tente novamente.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await getUserMetaIntegrations();
      setIntegrations(data);
      
      // Auto-select first integration
      if (data.length > 0 && onSelectIntegration) {
        setSelectedId(data[0].id);
        onSelectIntegration({ id: data[0].id, name: data[0].page_name });
      }
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      // Get Auth URL from backend
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const response = await fetch("/api/meta/auth", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Redirect to Meta
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Error initiating connection:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conexão. Contacte o suporte.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await deleteMetaIntegration(id);
      setIntegrations(integrations.filter(i => i.id !== id));
      
      if (selectedId === id) {
        const remaining = integrations.filter(i => i.id !== id);
        if (remaining.length > 0 && onSelectIntegration) {
          setSelectedId(remaining[0].id);
          onSelectIntegration({ id: remaining[0].id, name: remaining[0].page_name });
        } else {
          setSelectedId(null);
          if (onSelectIntegration) onSelectIntegration(null as any);
        }
      }
      
      toast({
        title: "Desconectado",
        description: "Página desconectada com sucesso.",
      });
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar página.",
        variant: "destructive",
      });
    }
  };

  const handleSelectIntegration = (integration: MetaIntegration) => {
    setSelectedId(integration.id);
    if (onSelectIntegration) {
      onSelectIntegration({ id: integration.id, name: integration.page_name });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-blue-600" />
          Meta Lead Ads
        </CardTitle>
        <CardDescription>
          Conecte suas páginas do Facebook e Instagram para receber leads automaticamente no CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {integrations.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-500">Páginas Conectadas</h4>
                {integrations.map((integration) => (
                  <div 
                    key={integration.id} 
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      selectedId === integration.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 hover:bg-gray-100 cursor-pointer'
                    }`}
                    onClick={() => handleSelectIntegration(integration)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Facebook className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{integration.page_name || "Página sem nome"}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">ID: {integration.page_id}</span>
                          {integration.webhook_subscribed ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 h-5 text-[10px]">
                              <CheckCircle className="h-3 w-3 mr-1" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 h-5 text-[10px]">
                              <AlertCircle className="h-3 w-3 mr-1" /> Inativo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedId === integration.id && (
                        <Badge variant="default" className="bg-blue-600">
                          <Settings className="h-3 w-3 mr-1" /> Selecionada
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDisconnect(integration.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <Button 
                onClick={handleConnect} 
                disabled={connecting}
                className="bg-[#1877F2] hover:bg-[#166fe5]"
              >
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Facebook className="mr-2 h-4 w-4" />
                )}
                {integrations.length > 0 ? "Conectar Outra Página" : "Conectar com Facebook"}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Você será redirecionado para o Facebook para autorizar o acesso às suas páginas e leads.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}