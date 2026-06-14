import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Save, Search, Shield } from "lucide-react";
import type { ExternalPropertyPortal } from "@/types";

interface PortalDefinition {
  id: string;
  name: string;
  description: string;
  scope: "user" | "global";
}

const AVAILABLE_PORTALS: PortalDefinition[] = [
  {
    id: "casayes",
    name: "Casa Yes",
    description: "Pesquisa na rede Casa Yes via API REST (requer endpoint GET de imóveis).",
    scope: "user",
  },
  {
    id: "idealista",
    name: "Idealista",
    description: "Pesquisa de imóveis no portal Idealista.",
    scope: "user",
  },
  {
    id: "remax",
    name: "REMAX",
    description: "Integração global da equipa com a API Parse.bot para pesquisar empreendimentos e unidades REMAX.",
    scope: "global",
  },
];

const REMAX_SYSTEM_KEYS = {
  enabled: "remax_parse_enabled",
  apiKey: "remax_parse_api_key",
  snapshotVersion: "remax_parse_api_snapshot_version",
} as const;

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

      const { data: portalData, error: portalsError } = await (supabase as any)
        .from("external_property_portals")
        .select("*")
        .eq("user_id", session.user.id);

      if (portalsError) {
        throw portalsError;
      }

      const { data: remaxSettings, error: remaxError } = await supabase
        .from("system_settings" as any)
        .select("key, value")
        .in("key", [
          REMAX_SYSTEM_KEYS.enabled,
          REMAX_SYSTEM_KEYS.apiKey,
          REMAX_SYSTEM_KEYS.snapshotVersion,
        ]);

      if (remaxError) {
        throw remaxError;
      }

      const portalsMap: Record<string, Partial<ExternalPropertyPortal>> = {};

      if (portalData) {
        portalData.forEach((portal: ExternalPropertyPortal) => {
          portalsMap[portal.provider_name] = portal;
        });
      }

      const remaxSettingsMap = new Map<string, string>();
      (remaxSettings || []).forEach((setting: any) => {
        if (typeof setting?.key === "string") {
          remaxSettingsMap.set(setting.key, typeof setting?.value === "string" ? setting.value : "");
        }
      });

      portalsMap.remax = {
        provider_name: "remax",
        is_enabled: remaxSettingsMap.get(REMAX_SYSTEM_KEYS.enabled) === "true",
        api_key: remaxSettingsMap.get(REMAX_SYSTEM_KEYS.apiKey) || "",
        api_secret: remaxSettingsMap.get(REMAX_SYSTEM_KEYS.snapshotVersion) || "2",
      };

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

      if (providerId === "remax") {
        const remaxState = portals.remax || {};
        const apiKey = typeof remaxState.api_key === "string" ? remaxState.api_key.trim() : "";
        const snapshotVersion =
          typeof remaxState.api_secret === "string" && remaxState.api_secret.trim() !== ""
            ? remaxState.api_secret.trim()
            : "2";

        if (remaxState.is_enabled && !apiKey) {
          toast({
            title: "Chave em falta",
            description: "Introduz a chave da API REMAX antes de ativares a integração global.",
            variant: "destructive",
          });
          return;
        }

        const settingsPayload = [
          {
            key: REMAX_SYSTEM_KEYS.enabled,
            value: remaxState.is_enabled ? "true" : "false",
            updated_at: new Date().toISOString(),
          },
          {
            key: REMAX_SYSTEM_KEYS.apiKey,
            value: apiKey,
            updated_at: new Date().toISOString(),
          },
          {
            key: REMAX_SYSTEM_KEYS.snapshotVersion,
            value: snapshotVersion,
            updated_at: new Date().toISOString(),
          },
        ];

        const { error } = await supabase
          .from("system_settings" as any)
          .upsert(settingsPayload, { onConflict: "key" });

        if (error) {
          throw error;
        }

        toast({
          title: "Configuração global guardada",
          description: "A integração REMAX ficou disponível para toda a equipa.",
        });
        return;
      }

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
                    {portalDef.scope === "global" && (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        Global
                      </Badge>
                    )}
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
                  {portalDef.id === "remax" ? (
                    <>
                      <div className="flex items-start space-x-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
                        <Shield className="mt-0.5 h-5 w-5 text-blue-600" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-blue-900">Configuração global da equipa</p>
                          <p className="text-xs text-blue-800">
                            Esta chave é guardada centralmente e usada pelo painel REMAX da lead e pelo Agente IA para todos os utilizadores.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Chave da API Parse.bot</Label>
                          <Input
                            type="password"
                            value={typeof state.api_key === "string" ? state.api_key : ""}
                            onChange={(event) => handleUpdateField(portalDef.id, "api_key", event.target.value)}
                            placeholder="pmx_..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Snapshot Version</Label>
                          <Input
                            value={typeof state.api_secret === "string" ? state.api_secret : "2"}
                            onChange={(event) => handleUpdateField(portalDef.id, "api_secret", event.target.value)}
                            placeholder="2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Endpoint utilizado</Label>
                          <Input value="/search_developments" disabled className="bg-white" />
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        A integração REMAX usa a Parse.bot e pesquisa empreendimentos com unidades aninhadas. Depois de guardada aqui, deixa de ser necessário configurar a chave em ficheiros do projeto para o uso normal da app.
                      </p>
                    </>
                  ) : (
                    <>
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
                          O URL de pesquisa GET a ser usado pelo Vyxa. Consulte a documentação do portal.
                        </p>
                      </div>
                    </>
                  )}

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
                      {portalDef.id === "remax" ? "Guardar Configuração Global" : "Guardar Configurações"}
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