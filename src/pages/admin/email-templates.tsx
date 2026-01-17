import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { emailTemplateService, type EmailTemplate } from "@/services/emailTemplateService";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Plus, Edit, Copy, Trash2, Info, X } from "lucide-react";

export default function EmailTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [newRecipient, setNewRecipient] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_type: "daily_email" as "daily_email" | "workflow" | "whatsapp",
    subject: "",
    html_body: "",
    text_body: "",
    is_active: true,
    recipient_emails: [] as string[],
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await emailTemplateService.getAll();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      template_type: "daily_email",
      subject: "",
      html_body: "",
      text_body: "",
      is_active: true,
      recipient_emails: [],
    });
    setDialogOpen(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      template_type: template.template_type,
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body || "",
      is_active: template.is_active,
      recipient_emails: template.recipient_emails || [],
    });
    setDialogOpen(true);
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não identificado",
          variant: "destructive",
        });
        return;
      }

      await emailTemplateService.duplicate(template.id, user.id);
      toast({
        title: "Sucesso",
        description: "Template duplicado com sucesso",
      });
      loadTemplates();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível duplicar o template",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (template.is_default) {
      toast({
        title: "Erro",
        description: "Não é possível eliminar templates padrão",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Tem certeza que deseja eliminar este template?")) {
      return;
    }

    try {
      await emailTemplateService.delete(template.id);
      toast({
        title: "Sucesso",
        description: "Template eliminado com sucesso",
      });
      loadTemplates();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível eliminar o template",
        variant: "destructive",
      });
    }
  };

  const handleAddRecipient = () => {
    const email = newRecipient.trim();
    if (!email) return;

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Erro",
        description: "Email inválido",
        variant: "destructive",
      });
      return;
    }

    if (formData.recipient_emails.includes(email)) {
      toast({
        title: "Aviso",
        description: "Este email já foi adicionado",
        variant: "destructive",
      });
      return;
    }

    setFormData({
      ...formData,
      recipient_emails: [...formData.recipient_emails, email],
    });
    setNewRecipient("");
  };

  const handleRemoveRecipient = (email: string) => {
    setFormData({
      ...formData,
      recipient_emails: formData.recipient_emails.filter((e) => e !== email),
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingTemplate) {
        await emailTemplateService.update(editingTemplate.id, formData);
        toast({
          title: "Sucesso",
          description: "Template atualizado com sucesso",
        });
      } else {
        await emailTemplateService.create(formData);
        toast({
          title: "Sucesso",
          description: "Template criado com sucesso",
        });
      }
      setDialogOpen(false);
      loadTemplates();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o template",
        variant: "destructive",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      daily_email: "Email Diário",
      workflow: "Workflow",
      whatsapp: "WhatsApp",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors = {
      daily_email: "bg-blue-100 text-blue-800",
      workflow: "bg-purple-100 text-purple-800",
      whatsapp: "bg-green-100 text-green-800",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getAvailableVariables = (type: string) => {
    const variables = {
      daily_email: ["userName", "date", "hasEvents", "events", "hasTasks", "tasks"],
      workflow: ["userName", "workflowName", "message", "leadName", "leadEmail", "leadPhone", "leadSource", "actionUrl"],
      whatsapp: ["userName", "tasks", "date"],
    };
    return variables[type as keyof typeof variables] || [];
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Mail className="h-8 w-8 text-amber-600" />
                Templates de Email
              </h1>
              <p className="text-gray-600 mt-2">Personalize os emails automáticos do sistema</p>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>

          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Os templates de email são usados pelos CRON jobs (emails diários) e workflows automáticos. Use variáveis como{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{userName}}"}</code> para personalizar.
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="text-center py-12">Carregando templates...</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 mb-2">
                          {template.name}
                          {template.is_default && <Badge variant="outline">Padrão</Badge>}
                        </CardTitle>
                        <Badge className={getTypeBadgeColor(template.template_type)}>{getTypeLabel(template.template_type)}</Badge>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${template.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                    </div>
                    {template.description && <CardDescription className="mt-2">{template.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Assunto:</p>
                        <p className="text-sm text-gray-600 truncate">{template.subject}</p>
                      </div>
                      
                      {template.recipient_emails && template.recipient_emails.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Destinatários:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.recipient_emails.slice(0, 2).map((email) => (
                              <Badge key={email} variant="secondary" className="text-xs">
                                {email}
                              </Badge>
                            ))}
                            {template.recipient_emails.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{template.recipient_emails.length - 2} mais
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-3 border-t">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(template)} className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDuplicate(template)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!template.is_default && (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(template)}>
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
                <DialogDescription>Configure o template de email para automações</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome do Template</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Email de Boas-vindas"
                    />
                  </div>

                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select value={formData.template_type} onValueChange={(value: any) => setFormData({ ...formData, template_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily_email">Email Diário</SelectItem>
                        <SelectItem value="workflow">Workflow</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Breve descrição do template"
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Assunto do email (pode usar variáveis)"
                  />
                </div>

                <div>
                  <Label>Destinatários Adicionais</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddRecipient()}
                      placeholder="email@exemplo.com"
                      type="email"
                    />
                    <Button type="button" onClick={handleAddRecipient} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.recipient_emails.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md">
                      {formData.recipient_emails.map((email) => (
                        <Badge key={email} variant="secondary" className="flex items-center gap-1">
                          {email}
                          <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => handleRemoveRecipient(email)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Emails adicionais que receberão este template (além do email do utilizador)
                  </p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Variáveis disponíveis:</strong>{" "}
                    {getAvailableVariables(formData.template_type).map((v) => (
                      <code key={v} className="bg-gray-100 px-1 rounded mx-1">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </AlertDescription>
                </Alert>

                <Tabs defaultValue="html">
                  <TabsList>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                    <TabsTrigger value="text">Texto Simples</TabsTrigger>
                  </TabsList>

                  <TabsContent value="html">
                    <Label htmlFor="html_body">Corpo HTML</Label>
                    <Textarea
                      id="html_body"
                      value={formData.html_body}
                      onChange={(e) => setFormData({ ...formData, html_body: e.target.value })}
                      placeholder="<html>...</html>"
                      className="font-mono h-64"
                    />
                  </TabsContent>

                  <TabsContent value="text">
                    <Label htmlFor="text_body">Corpo em Texto Simples</Label>
                    <Textarea
                      id="text_body"
                      value={formData.text_body}
                      onChange={(e) => setFormData({ ...formData, text_body: e.target.value })}
                      placeholder="Versão em texto simples do email..."
                      className="h-64"
                    />
                  </TabsContent>
                </Tabs>

                <div className="flex items-center space-x-2">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  <Label htmlFor="is_active">Template ativo</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>{editingTemplate ? "Atualizar" : "Criar"} Template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}