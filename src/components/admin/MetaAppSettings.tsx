import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { getMetaAppSettings, updateMetaAppSettings, type MetaAppSettings } from "@/services/metaService";

export function MetaAppSettings() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Partial<MetaAppSettings>>({
    app_id: "",
    app_secret: "",
    verify_token: "",
    webhook_url: "",
    is_active: false
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getMetaAppSettings();
      if (data) {
        setSettings({
          app_id: data.app_id || "",
          app_secret: data.app_secret || "",
          verify_token: data.verify_token || "",
          webhook_url: `${window.location.origin}/api/meta/webhook`,
          is_active: data.is_active || false
        });
      }
    } catch (error) {
      console.error("Error loading Meta settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateMetaAppSettings(settings);
      toast({
        title: "Sucesso",
        description: "Configurações da Meta atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateVerifyToken = () => {
    const token = crypto.randomUUID();
    setSettings({ ...settings, verify_token: token });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integração Meta (Facebook/Instagram)</CardTitle>
        <CardDescription>
          Configure as credenciais da sua App Meta para permitir que os utilizadores conectem suas páginas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="meta-active"
            checked={settings.is_active}
            onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
          />
          <Label htmlFor="meta-active">Ativar Integração Meta</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="app_id">App ID</Label>
            <Input
              id="app_id"
              value={settings.app_id}
              onChange={(e) => setSettings({ ...settings, app_id: e.target.value })}
              placeholder="Ex: 1234567890"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app_secret">App Secret</Label>
            <Input
              id="app_secret"
              type="password"
              value={settings.app_secret}
              onChange={(e) => setSettings({ ...settings, app_secret: e.target.value })}
              placeholder="••••••••••••••••"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook_url">Webhook URL</Label>
          <div className="flex gap-2">
            <Input
              id="webhook_url"
              value={settings.webhook_url}
              readOnly
              className="bg-gray-50"
            />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(settings.webhook_url);
                toast({ title: "Copiado!", description: "URL copiado para a área de transferência." });
              }}
            >
              Copiar
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Configure este URL no painel de Webhooks da sua Meta App.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="verify_token">Verify Token</Label>
          <div className="flex gap-2">
            <Input
              id="verify_token"
              value={settings.verify_token}
              onChange={(e) => setSettings({ ...settings, verify_token: e.target.value })}
            />
            <Button variant="outline" onClick={generateVerifyToken}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Gerar
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Use este token para verificar o webhook na Meta.
          </p>
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}