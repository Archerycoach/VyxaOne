import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  FileText, 
  Settings, 
  RefreshCw, 
  Download, 
  Trash2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Plus,
  Save,
  Wand2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getFormConfigs,
  createOrUpdateFormConfig,
  getFieldMappings,
  saveFieldMappings,
  getSyncHistory,
  type MetaFormConfig,
  type MetaFieldMapping,
  type MetaSyncHistory
} from "@/services/metaService";
import { getAllProperties } from "@/services/propertiesService";
import { getDevelopments } from "@/services/developmentsService";
import { getBuyerStages, getSellerStages, type PipelineStage } from "@/services/pipelineSettingsService";

interface MetaForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
  created_time: string;
  config: MetaFormConfig | null;
  questions?: Array<{ key: string; label: string; type: string }>;
}

interface MetaFormsManagementProps {
  integrationId: string;
  integrationName: string;
}

interface PropertyOption {
  id: string;
  title: string;
  city?: string;
}

interface DevelopmentOption {
  id: string;
  name: string;
  city?: string | null;
}

export function MetaFormsManagement({ integrationId, integrationName }: MetaFormsManagementProps) {
  const [forms, setForms] = useState<MetaForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<MetaForm | null>(null);
  const [formConfig, setFormConfig] = useState<Partial<MetaFormConfig>>({});
  const [fieldMappings, setFieldMappings] = useState<Partial<MetaFieldMapping>[]>([]);
  const [syncHistory, setSyncHistory] = useState<MetaSyncHistory[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [buyerStages, setBuyerStages] = useState<PipelineStage[]>([]);
  const [sellerStages, setSellerStages] = useState<PipelineStage[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [developments, setDevelopments] = useState<DevelopmentOption[]>([]);
  const [resubscribing, setResubscribing] = useState(false);
  const [autoDailySync, setAutoDailySync] = useState(false);
  const [dailySyncHour, setDailySyncHour] = useState(6);
  const [lastDailySyncAt, setLastDailySyncAt] = useState<string | null>(null);
  const [savingDailySync, setSavingDailySync] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadForms();
    loadPipelineStages();
    loadAssociationOptions();
    loadIntegrationSettings();
  }, [integrationId]);

  const loadIntegrationSettings = async () => {
    try {
      const { data: integration }: { data: any } = await supabase
        .from("meta_integrations" as any)
        .select("auto_daily_sync, daily_sync_hour, last_daily_sync_at")
        .eq("id", integrationId)
        .single();

      if (integration) {
        setAutoDailySync(integration.auto_daily_sync || false);
        setDailySyncHour(integration.daily_sync_hour || 6);
        setLastDailySyncAt(integration.last_daily_sync_at);
      }
    } catch (error) {
      console.error("Error loading integration settings:", error);
    }
  };

  const loadPipelineStages = async () => {
    try {
      const [buyers, sellers] = await Promise.all([
        getBuyerStages(),
        getSellerStages()
      ]);
      setBuyerStages(buyers);
      setSellerStages(sellers);
    } catch (err) {
      console.error("Error loading pipeline stages:", err);
    }
  };

  const loadAssociationOptions = async () => {
    try {
      const [propertiesData, developmentsData] = await Promise.all([
        getAllProperties(false),
        getDevelopments(),
      ]);

      setProperties(
        propertiesData.map((property) => ({
          id: property.id,
          title: property.title,
          city: property.city,
        }))
      );

      setDevelopments(
        developmentsData.map((development) => ({
          id: development.id,
          name: development.name,
          city: development.city ?? null,
        }))
      );
    } catch (err) {
      console.error("Error loading association options:", err);
    }
  };

  useEffect(() => {
    if (selectedForm?.id) {
      loadFormConfig(selectedForm.id);
      loadSyncHistory(selectedForm.id);
    }
  }, [selectedForm]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(
        `/api/meta/forms?integration_id=${integrationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      setForms(data.forms || []);
    } catch (error) {
      console.error("Error loading forms:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar formulários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFormConfig = async (formId: string) => {
    try {
      const configs = await getFormConfigs(integrationId);
      const config = configs.find((c) => c.form_id === formId);
      
      if (config) {
        setFormConfig(config);
        const mappings = await getFieldMappings(config.id);
        setFieldMappings(mappings);
      } else {
        setFormConfig({
          integration_id: integrationId,
          form_id: formId,
          form_name: selectedForm?.name || "",
          auto_import: true,
          auto_email_notification: true,
          default_lead_source: `Meta - ${integrationName}`,
          association_type: "none",
          associated_property_id: null,
          associated_development_id: null,
          associated_development_name: null,
          is_active: true,
        });
        setFieldMappings([
          { meta_field_name: "full_name", crm_field_name: "name", field_type: "text", is_required: true, priority_order: 0 },
          { meta_field_name: "email", crm_field_name: "email", field_type: "text", is_required: false, priority_order: 1 },
          { meta_field_name: "phone_number", crm_field_name: "phone", field_type: "text", is_required: false, priority_order: 2 },
        ]);
      }
    } catch (error) {
      console.error("Error loading form config:", error);
    }
  };

  const loadSyncHistory = async (formId: string) => {
    try {
      const history = await getSyncHistory(integrationId);
      setSyncHistory(history.filter((h) => h.form_id === formId));
    } catch (error) {
      console.error("Error loading sync history:", error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (!selectedForm) return;

      if (formConfig.association_type === "property" && !formConfig.associated_property_id) {
        toast({
          title: "Imóvel em falta",
          description: "Selecione o imóvel a associar a este formulário Meta.",
          variant: "destructive",
        });
        return;
      }

      if (
        formConfig.association_type === "development" &&
        (!formConfig.associated_development_id || !formConfig.associated_development_name)
      ) {
        toast({
          title: "Empreendimento em falta",
          description: "Selecione o empreendimento a associar a este formulário Meta.",
          variant: "destructive",
        });
        return;
      }

      const savedConfig = await createOrUpdateFormConfig({
        ...formConfig,
        form_name: selectedForm.name,
      });

      if (fieldMappings.length > 0) {
        await saveFieldMappings(savedConfig.id, fieldMappings);
      }

      toast({
        title: "Sucesso",
        description: "Configuração salva com sucesso.",
      });

      setConfigDialogOpen(false);
      loadForms();
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração.",
        variant: "destructive",
      });
    }
  };

  const handleManualSync = async (formId: string, daysBack: number = 7) => {
    try {
      setSyncing(formId);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch("/api/meta/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          integration_id: integrationId,
          form_id: formId,
          days_back: daysBack,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Sincronização Concluída",
          description: `${data.results.created} leads criadas, ${data.results.skipped} duplicadas.`,
        });
        loadSyncHistory(formId);
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      toast({
        title: "Erro",
        description: "Erro ao sincronizar leads.",
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const addFieldMapping = () => {
    setFieldMappings([
      ...fieldMappings,
      {
        meta_field_name: "",
        crm_field_name: "",
        field_type: "text",
        is_required: false,
        priority_order: fieldMappings.length,
      },
    ]);
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const updateFieldMapping = (index: number, field: keyof MetaFieldMapping, value: any) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const autoGenerateMappings = () => {
    const defaultMappings: Partial<MetaFieldMapping>[] = [
      { meta_field_name: "full_name", crm_field_name: "name", field_type: "text", is_required: true },
      { meta_field_name: "email", crm_field_name: "email", field_type: "text", is_required: false },
      { meta_field_name: "phone_number", crm_field_name: "phone", field_type: "text", is_required: false },
      { meta_field_name: "city", crm_field_name: "location_preference", field_type: "text", is_required: false },
    ];

    const existingMetaFields = fieldMappings.map(m => m.meta_field_name?.toLowerCase());
    const newMappings = defaultMappings
      .filter(m => !existingMetaFields.includes(m.meta_field_name?.toLowerCase()))
      .map((m, i) => ({ ...m, priority_order: fieldMappings.length + i }));

    if (newMappings.length > 0) {
      setFieldMappings([...fieldMappings, ...newMappings]);
      toast({
        title: "Mapeamento Gerado",
        description: "Foram adicionados os campos padrão da Meta.",
      });
    } else {
      toast({
        title: "Sem alterações",
        description: "Os campos padrão já estão mapeados.",
      });
    }
  };

  const handleResubscribeWebhook = async () => {
    try {
      setResubscribing(true);
      
      console.log("[Frontend] Attempting to resubscribe webhook for integration:", integrationId);
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      console.log("[Frontend] Sending request with integration_id:", integrationId);

      const response = await fetch("/api/meta/resubscribe-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          integration_id: integrationId,
        }),
      });

      const data = await response.json();
      
      console.log("[Frontend] Response received:", data);

      if (data.success) {
        toast({
          title: "✓ Webhook Re-subscrito",
          description: "A sincronização em tempo real está agora ativa. Novas leads da Meta chegarão automaticamente.",
        });
      } else {
        throw new Error(data.error || "Falha ao re-subscrever webhook");
      }
    } catch (error: any) {
      console.error("Error resubscribing webhook:", error);
      toast({
        title: "Erro ao Re-subscrever",
        description: error.message || "Erro ao re-subscrever webhook. Verifique as suas permissões na Meta.",
        variant: "destructive",
      });
    } finally {
      setResubscribing(false);
    }
  };

  const handleSaveDailySync = async () => {
    try {
      setSavingDailySync(true);
      
      const { error } = await supabase
        .from("meta_integrations" as any)
        .update({
          auto_daily_sync: autoDailySync,
          daily_sync_hour: dailySyncHour,
        })
        .eq("id", integrationId);

      if (error) throw error;

      toast({
        title: "✓ Configuração Guardada",
        description: autoDailySync 
          ? `Sincronização automática ativada para as ${dailySyncHour}h diariamente.`
          : "Sincronização automática desativada.",
      });
    } catch (error: any) {
      console.error("Error saving daily sync settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao guardar configurações de sincronização.",
        variant: "destructive",
      });
    } finally {
      setSavingDailySync(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const displayedForms = forms.filter(form => showOnlyActive ? form.status === "ACTIVE" : true);

  return (
    <div className="space-y-4">
      {/* Webhook Diagnostics Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Sincronização em Tempo Real</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Webhook para captura automática de leads
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResubscribeWebhook}
              disabled={resubscribing}
              className="bg-white"
            >
              {resubscribing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A subscrever...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-subscrever Webhook
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg bg-white border p-3 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Como funciona a sincronização em tempo real:</p>
                <ul className="text-gray-600 text-xs mt-1 space-y-1 ml-1">
                  <li>• A Meta envia webhooks quando há uma nova lead nos seus formulários</li>
                  <li>• As leads aparecem automaticamente na plataforma sem sincronização manual</li>
                  <li>• Se as leads não estiverem a chegar automaticamente, clique em "Re-subscrever Webhook"</li>
                </ul>
              </div>
            </div>
            
            <div className="pt-2 mt-2 border-t">
              <p className="text-xs text-gray-600">
                <strong>Nota:</strong> Se a sincronização em tempo real não funcionar após re-subscrever, 
                verifique se a sua aplicação Meta tem permissões de <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">leads_retrieval</code> 
                e se o webhook está configurado para o evento <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">leadgen</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Sync Configuration Card */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">Sincronização Automática Diária</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Backup que garante que nenhuma lead seja perdida
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="rounded-lg bg-white border p-4 space-y-4">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Sistema de backup automático:</p>
                <ul className="text-gray-600 text-xs mt-1 space-y-1 ml-1">
                  <li>• Sincroniza automaticamente uma vez por dia às horas configuradas</li>
                  <li>• Captura leads que possam não ter chegado via webhook em tempo real</li>
                  <li>• Funciona independentemente do webhook (dupla segurança)</li>
                  <li>• Deteta e ignora leads duplicadas automaticamente</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    id="auto-daily-sync"
                    checked={autoDailySync}
                    onCheckedChange={setAutoDailySync}
                  />
                  <Label htmlFor="auto-daily-sync" className="cursor-pointer">
                    <span className="font-medium">Ativar sincronização automática diária</span>
                  </Label>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveDailySync}
                  disabled={savingDailySync}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {savingDailySync ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>

              {autoDailySync && (
                <div className="space-y-2 pl-11">
                  <Label htmlFor="sync-hour" className="text-sm">
                    Hora da sincronização (formato 24h):
                  </Label>
                  <Select
                    value={dailySyncHour.toString()}
                    onValueChange={(value) => setDailySyncHour(parseInt(value))}
                  >
                    <SelectTrigger id="sync-hour" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    A sincronização será executada diariamente à hora selecionada (hora do servidor UTC).
                  </p>
                </div>
              )}

              {lastDailySyncAt && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-600">
                    <strong>Última sincronização automática:</strong>{" "}
                    {new Date(lastDailySyncAt).toLocaleString("pt-PT")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Formulários - {integrationName}
            </CardTitle>
            <CardDescription>
              Configure a captura e mapeamento de campos para cada formulário Meta.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Switch 
              id="show-active-only" 
              checked={showOnlyActive} 
              onCheckedChange={setShowOnlyActive} 
            />
            <Label htmlFor="show-active-only" className="text-sm font-medium cursor-pointer">
              Apenas ativos
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          {displayedForms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum formulário {showOnlyActive ? "ativo " : ""}encontrado nesta página Meta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedForms.map((form) => (
                <div
                  key={form.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{form.name}</h4>
                      
                      {form.status === "ACTIVE" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Meta: Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                          Meta: {form.status}
                        </Badge>
                      )}

                      {form.config?.auto_import ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sinc. Automática Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          Sinc. Automática Inativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {form.leads_count} leads • ID: {form.id}
                    </p>
                    {form.config && (
                      <div className="flex gap-2 mt-2">
                        {form.config.auto_import && (
                          <Badge variant="outline" className="text-xs hidden">
                            Auto-import
                          </Badge>
                        )}
                        {form.config.auto_email_notification && (
                          <Badge variant="outline" className="text-xs">
                            Email notif.
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManualSync(form.id)}
                      disabled={syncing === form.id}
                    >
                      {syncing === form.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedForm(form);
                        setConfigDialogOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Formulário</DialogTitle>
            <DialogDescription>
              {selectedForm?.name} - Configure captura e mapeamento de campos
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="mapping">Mapeamento</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_import"
                    checked={formConfig.auto_import}
                    onCheckedChange={(checked) =>
                      setFormConfig({ ...formConfig, auto_import: checked })
                    }
                  />
                  <Label htmlFor="auto_import">Importação Automática</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_email"
                    checked={formConfig.auto_email_notification}
                    onCheckedChange={(checked) =>
                      setFormConfig({ ...formConfig, auto_email_notification: checked })
                    }
                  />
                  <Label htmlFor="auto_email">Notificação por Email</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead_source">Origem da Lead</Label>
                  <Input
                    id="lead_source"
                    value={formConfig.default_lead_source}
                    onChange={(e) =>
                      setFormConfig({ ...formConfig, default_lead_source: e.target.value })
                    }
                    placeholder="Ex: Meta - Campanha Verão"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pipeline_stage">Fase Inicial do Pipeline</Label>
                  <Select
                    value={formConfig.default_pipeline_stage || "new"}
                    onValueChange={(value) =>
                      setFormConfig({ ...formConfig, default_pipeline_stage: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="bg-gray-50">Compradores</SelectLabel>
                        {buyerStages.map(stage => (
                          <SelectItem key={`buyer-${stage.id}`} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="bg-gray-50 mt-2">Vendedores</SelectLabel>
                        {sellerStages.map(stage => (
                          <SelectItem key={`seller-${stage.id}`} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label>Associação automática</Label>
                    <p className="text-sm text-gray-500">
                      Defina se as leads deste formulário devem entrar já ligadas a um imóvel ou a um empreendimento.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de associação</Label>
                    <Select
                      value={formConfig.association_type || "none"}
                      onValueChange={(value) => {
                        if (value === "property") {
                          setFormConfig({
                            ...formConfig,
                            association_type: "property",
                            associated_development_id: null,
                            associated_development_name: null,
                          });
                          return;
                        }

                        if (value === "development") {
                          setFormConfig({
                            ...formConfig,
                            association_type: "development",
                            associated_property_id: null,
                          });
                          return;
                        }

                        setFormConfig({
                          ...formConfig,
                          association_type: "none",
                          associated_property_id: null,
                          associated_development_id: null,
                          associated_development_name: null,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o tipo de associação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem associação automática</SelectItem>
                        <SelectItem value="property">Associar a imóvel</SelectItem>
                        <SelectItem value="development">Associar a empreendimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formConfig.association_type === "property" && (
                    <div className="space-y-2">
                      <Label>Imóvel associado</Label>
                      <Select
                        value={formConfig.associated_property_id || "none"}
                        onValueChange={(value) =>
                          setFormConfig({
                            ...formConfig,
                            associated_property_id: value === "none" ? null : value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um imóvel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem imóvel associado</SelectItem>
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.title}{property.city ? ` • ${property.city}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formConfig.association_type === "development" && (
                    <div className="space-y-2">
                      <Label>Empreendimento associado</Label>
                      <Select
                        value={formConfig.associated_development_id || "none"}
                        onValueChange={(value) => {
                          const selectedDevelopment = developments.find(
                            (development) => development.id === value
                          );

                          setFormConfig({
                            ...formConfig,
                            associated_development_id: value === "none" ? null : value,
                            associated_development_name:
                              value === "none" ? null : selectedDevelopment?.name || null,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um empreendimento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem empreendimento associado</SelectItem>
                          {developments.map((development) => (
                            <SelectItem key={development.id} value={development.id}>
                              {development.name}{development.city ? ` • ${development.city}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        A lead ficará marcada com o empreendimento selecionado quando entrar por este formulário.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Field Mapping */}
            <TabsContent value="mapping" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Mapeamento de Campos</h4>
                    <p className="text-sm text-gray-500">
                      Configure como os campos do formulário Meta são mapeados para o CRM
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={autoGenerateMappings}>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Gerar Padrão
                    </Button>
                    <Button size="sm" onClick={addFieldMapping}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {fieldMappings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    <p>Nenhum mapeamento configurado.</p>
                    <p className="text-xs mt-1">
                      Campos standard (nome, email, telefone) são mapeados automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fieldMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                        {selectedForm?.questions && selectedForm.questions.length > 0 ? (
                          <Select
                            value={mapping.meta_field_name}
                            onValueChange={(value) =>
                              updateFieldMapping(index, "meta_field_name", value)
                            }
                          >
                            <SelectTrigger className="flex-1 min-w-0 overflow-hidden text-left">
                              <span className="truncate block w-full"><SelectValue placeholder="Campo Meta" /></span>
                            </SelectTrigger>
                            <SelectContent>
                              {selectedForm.questions.map((q) => (
                                <SelectItem key={q.key} value={q.key}>
                                  {q.label} ({q.key})
                                </SelectItem>
                              ))}
                              {mapping.meta_field_name && !selectedForm.questions.some(q => q.key === mapping.meta_field_name) && (
                                <SelectItem value={mapping.meta_field_name}>
                                  {mapping.meta_field_name}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="Campo Meta (ex: qual_o_seu_orcamento)"
                            value={mapping.meta_field_name}
                            onChange={(e) =>
                              updateFieldMapping(index, "meta_field_name", e.target.value)
                            }
                            className="flex-1 min-w-0"
                          />
                        )}
                        <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                        <Select
                          value={mapping.crm_field_name}
                          onValueChange={(value) =>
                            updateFieldMapping(index, "crm_field_name", value)
                          }
                        >
                          <SelectTrigger className="flex-1 min-w-0 overflow-hidden text-left">
                            <span className="truncate block w-full"><SelectValue placeholder="Campo CRM" /></span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name">Nome</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Telefone</SelectItem>
                            <SelectItem value="budget">Orçamento (Texto)</SelectItem>
                            <SelectItem value="budget_min">Orçamento Mínimo</SelectItem>
                            <SelectItem value="budget_max">Orçamento Máximo</SelectItem>
                            <SelectItem value="desired_price">Preço Desejado</SelectItem>
                            <SelectItem value="buy_purpose">Objetivo (Habitação/Investimento)</SelectItem>
                            <SelectItem value="location_preference">Localização / Zona</SelectItem>
                            <SelectItem value="property_type">Tipo de Imóvel</SelectItem>
                            <SelectItem value="lead_type">Tipo de Cliente (buyer/seller)</SelectItem>
                            <SelectItem value="bedrooms">Nº de Quartos</SelectItem>
                            <SelectItem value="bathrooms">Nº de Casas de Banho</SelectItem>
                            <SelectItem value="min_area">Área Mínima (m2)</SelectItem>
                            <SelectItem value="max_area">Área Máxima (m2)</SelectItem>
                            <SelectItem value="property_area">Área do Imóvel (m2)</SelectItem>
                            <SelectItem value="needs_financing">Precisa Financiamento (true/false)</SelectItem>
                            <SelectItem value="has_property_to_sell">Tem imóvel p/ vender (true/false)</SelectItem>
                            <SelectItem value="development_name">Nome do Empreendimento</SelectItem>
                            <SelectItem value="birthday">Data de Nascimento</SelectItem>
                            <SelectItem value="notes">Notas / Observações</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFieldMapping(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Sync History */}
            <TabsContent value="history" className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">Histórico de Sincronizações</h4>
                {syncHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma sincronização realizada ainda.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.map((sync) => (
                        <TableRow key={sync.id}>
                          <TableCell>
                            {new Date(sync.created_at).toLocaleString("pt-PT")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sync.sync_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {sync.status === "completed" ? (
                              <Badge className="bg-green-100 text-green-700">Sucesso</Badge>
                            ) : sync.status === "failed" ? (
                              <Badge variant="destructive">Erro</Badge>
                            ) : (
                              <Badge variant="secondary">A correr...</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-sm">
                              <div className="text-green-600">+{sync.leads_created} criadas</div>
                              <div className="text-gray-500">{sync.leads_skipped} duplicadas</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configuração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}