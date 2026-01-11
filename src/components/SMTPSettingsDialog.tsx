import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  getSMTPSettings,
  saveSMTPSettings,
  testSMTPConnection,
  deleteSMTPSettings,
  type SMTPSettings,
} from "@/services/smtpService";
import { Loader2, Mail, Server, Shield, Trash2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SMTPSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SMTPSettingsDialog({ open, onOpenChange }: SMTPSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [settings, setSettings] = useState<Omit<SMTPSettings, "id" | "user_id">>({
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: false,
    smtp_username: "",
    smtp_password: "",
    from_email: "",
    from_name: "",
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getSMTPSettings();
      if (data) {
        setSettings({
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port,
          smtp_secure: data.smtp_secure,
          smtp_username: data.smtp_username,
          smtp_password: data.smtp_password,
          from_email: data.from_email,
          from_name: data.from_name || "",
          is_active: data.is_active,
        });
      }
    } catch (error) {
      console.error("Error loading SMTP settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setTestResult(null);

      if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password || !settings.from_email) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha todos os campos obrigatórios",
          variant: "destructive",
        });
        return;
      }

      await saveSMTPSettings(settings);

      toast({
        title: "Configurações guardadas",
        description: "As suas configurações SMTP foram guardadas com sucesso",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving SMTP settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível guardar as configurações SMTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha os campos de servidor, porta, utilizador e password",
          variant: "destructive",
        });
        return;
      }

      const result = await testSMTPConnection(settings);
      setTestResult(result);

      if (result.success) {
        toast({
          title: "Conexão bem-sucedida",
          description: result.message,
        });
      } else {
        toast({
          title: "Erro de conexão",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error testing SMTP:", error);
      toast({
        title: "Erro",
        description: "Não foi possível testar a conexão SMTP",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);

      await deleteSMTPSettings();

      toast({
        title: "Configurações removidas",
        description: "As configurações SMTP foram removidas com sucesso",
      });

      setSettings({
        smtp_host: "",
        smtp_port: 587,
        smtp_secure: false,
        smtp_username: "",
        smtp_password: "",
        from_email: "",
        from_name: "",
        is_active: true,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting SMTP settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover as configurações SMTP",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configurações SMTP
          </DialogTitle>
          <DialogDescription>
            Configure o seu servidor SMTP para enviar emails diretamente da aplicação
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <div className="space-y-6">
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4" />
                Servidor SMTP
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">
                    Servidor <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_host"
                    placeholder="smtp.gmail.com"
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_port">
                    Porta <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    placeholder="587"
                    value={settings.smtp_port}
                    onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="smtp_secure"
                  checked={settings.smtp_secure}
                  onCheckedChange={(checked) => setSettings({ ...settings, smtp_secure: checked })}
                />
                <Label htmlFor="smtp_secure" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Usar SSL/TLS (porta 465)
                </Label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                Autenticação
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_username">
                    Utilizador (Email) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_username"
                    type="email"
                    placeholder="seu.email@example.com"
                    value={settings.smtp_username}
                    onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_password">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_password"
                    type="password"
                    placeholder="••••••••"
                    value={settings.smtp_password}
                    onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                Remetente
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from_email">
                    Email do remetente <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="from_email"
                    type="email"
                    placeholder="seu.email@example.com"
                    value={settings.from_email}
                    onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from_name">Nome do remetente (opcional)</Label>
                  <Input
                    id="from_name"
                    placeholder="Seu Nome"
                    value={settings.from_name}
                    onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={settings.is_active}
                onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
              />
              <Label htmlFor="is_active">Ativar envio de emails por SMTP</Label>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1">
            {settings.smtp_host && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || loading}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A remover...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover configuração
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || loading}
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A testar...
                </>
              ) : (
                "Testar conexão"
              )}
            </Button>
            <Button onClick={handleSave} disabled={loading || testing}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}