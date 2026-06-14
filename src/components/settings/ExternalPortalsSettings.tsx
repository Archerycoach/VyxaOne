import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Globe, Save, Search } from "lucide-react";
import type { ExternalPropertyPortal } from "@/types";

interface PortalDefinition {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_PORTALS: PortalDefinition[] = [
  {
    id: "casayes",
    name: "Casa Yes",
    description: "Pesquisa na rede Casa Yes via API REST (requer endpoint GET de imóveis).",
  },
  {
    id: "idealista",
    name: "Idealista",
    description: "Pesquisa de imóveis no portal Idealista.",
  },
];

export function ExternalPortalsSettings() {
  const [portals, setPortals] = useState<Record<string, Partial<ExternalPropertyPortal>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        return;
      }

      const { data: portalData, error } = await (supabase as any)
        .from("external_property_portals")
        .select("*")
        .eq("user_id", session.user.id);

      if (error) {
        throw error;
      }

      const portalsMap: Record<string, Partial<ExternalPropertyPortal>> = {};

      if (portalData) {
        portalData.forEach((portal: ExternalPropertyPortal) => {
          portalsMap[portal.provider_name] = portal;
        });
      }

      setPortals(portalsMap);
    } catch (error) {
      console.error("Error loading external portals:", error);
      toast({
        title: "Erro ao carregar portais",
        description: "Não foi possível carregar as configurações dos portais externos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const savePortal = async (providerId: string) => {
    try {
      setIsSaving(providerId);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        return;
      }

      const portalData = portals[providerId] || {};
      const payload = {
        user_id: session.user.id,
        provider_name: providerId,
        is_enabled: portalData.is_enabled || false,
        api_key: portalData.api_key || null,
        api_secret: portalData.api_secret || null,
        base_url: portalData.base_url || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("external_property_portals")
        .upsert(payload, { onConflict: "user_id,provider_name" });

      if (error) {
        throw error;
      }

      toast({
        title: "Definições guardadas",
        description: `As definições para ${AVAILABLE_PORTALS.find((portal) => portal.id === providerId)?.name} foram atualizadas.`,
      });
    } catch (error) {
      console.error("Error saving portal:", error);
      toast({
        title: "Erro ao guardar",
        description: "Ocorreu um erro ao guardar as definições.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(null);
    }
  };

  const handleUpdateField = (providerId: string, field: string, value: unknown) => {
    setPortals((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || { provider_name: providerId }),
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-blue-600" />
          Pesquisa Externa (MLS / Portais)
        </CardTitle>
        <CardDescription>
          Ligue-se a APIs de terceiros para pesquisar imóveis no mercado. A Inteligência Artificial pode usar estes portais para encontrar propriedades ativas e enviar sugestões aos clientes.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {AVAILABLE_PORTALS.map((portalDef) => {
          const state = portals[portalDef.id] || {};

          return (
            <div key={portalDef.id} className="rounded-lg border bg-gray-50 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <Search className="h-4 w-4 text-gray-500" />
                    {portalDef.name}
                  </h3>
                  <p className="text-sm text-gray-500">{portalDef.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">Ativar</span>
                  <Switch
                    checked={!!state.is_enabled}
                    onCheckedChange={(checked) => handleUpdateField(portalDef.id, "is_enabled", checked)}
                  />
                </div>
              </div>

              {state.is_enabled && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>API Key (Opcional se Bearer)</Label>
                      <Input
                        value={typeof state.api_key === "string" ? state.api_key : ""}
                        onChange={(event) => handleUpdateField(portalDef.id, "api_key", event.target.value)}
                        placeholder="Ex: sk_live_..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>API Secret / Bearer Token</Label>
                      <Input
                        type="password"
                        value={typeof state.api_secret === "string" ? state.api_secret : ""}
                        onChange={(event) => handleUpdateField(portalDef.id, "api_secret", event.target.value)}
                        placeholder="Chave secreta de autenticação"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Endpoint Base URL (Pesquisa/Leitura)</Label>
                    <Input
                      value={typeof state.base_url === "string" ? state.base_url : ""}
                      onChange={(event) => handleUpdateField(portalDef.id, "base_url", event.target.value)}
                      placeholder="Ex: https://api.casayes.pt/v1/properties/search"
                    />
                    <p className="text-xs text-gray-500">
                      O URL de pesquisa GET a ser usado pela app. Consulte a documentação do portal.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => savePortal(portalDef.id)}
                      disabled={isSaving === portalDef.id}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSaving === portalDef.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Guardar Configurações
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}