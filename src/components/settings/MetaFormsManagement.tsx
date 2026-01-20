import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Save
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

interface MetaForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
  created_time: string;
  config: MetaFormConfig | null;
}

interface MetaFormsManagementProps {
  integrationId: string;
  integrationName: string;
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
  const { toast } = useToast();

  useEffect(() => {
    loadForms();
  }, [integrationId]);

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
          is_active: true,
        });
        setFieldMappings([]);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Formulários - {integrationName}
          </CardTitle>
          <CardDescription>
            Configure a captura e mapeamento de campos para cada formulário Meta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum formulário encontrado nesta página Meta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{form.name}</h4>
                      {form.config?.is_active ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {form.leads_count} leads • ID: {form.id}
                    </p>
                    {form.config && (
                      <div className="flex gap-2 mt-2">
                        {form.config.auto_import && (
                          <Badge variant="outline" className="text-xs">
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
                      <SelectItem value="new">Nova</SelectItem>
                      <SelectItem value="contacted">Contactada</SelectItem>
                      <SelectItem value="qualified">Qualificada</SelectItem>
                      <SelectItem value="meeting">Reunião Agendada</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Button size="sm" onClick={addFieldMapping}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
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
                        <Input
                          placeholder="Campo Meta (ex: qual_o_seu_orcamento)"
                          value={mapping.meta_field_name}
                          onChange={(e) =>
                            updateFieldMapping(index, "meta_field_name", e.target.value)
                          }
                          className="flex-1"
                        />
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <Select
                          value={mapping.crm_field_name}
                          onValueChange={(value) =>
                            updateFieldMapping(index, "crm_field_name", value)
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Campo CRM" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name">Nome</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Telefone</SelectItem>
                            <SelectItem value="budget">Orçamento</SelectItem>
                            <SelectItem value="location_preference">Localização</SelectItem>
                            <SelectItem value="property_type">Tipo de Imóvel</SelectItem>
                            <SelectItem value="notes">Notas</SelectItem>
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