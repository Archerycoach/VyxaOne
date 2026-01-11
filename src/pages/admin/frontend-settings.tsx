import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { frontendSettingsService, type FrontendSetting } from "@/services/frontendSettingsService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";

export default function FrontendSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FrontendSetting[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await frontendSettingsService.getAllSettings();
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (setting: FrontendSetting, newValue: any) => {
    try {
      setSaving(true);
      await frontendSettingsService.updateSetting(setting.id, {
        value: newValue,
      });

      toast({
        title: "Sucesso",
        description: "Configuração atualizada com sucesso",
      });

      await loadSettings();
    } catch (error) {
      console.error("Error saving setting:", error);
      toast({
        title: "Erro",
        description: "Não foi possível guardar a configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSettingInput = (setting: FrontendSetting) => {
    const value = typeof setting.value === "string" ? setting.value.replace(/"/g, "") : setting.value;

    if (setting.key.includes("color")) {
      return (
        <div className="flex gap-4 items-center">
          <Input
            type="color"
            defaultValue={value}
            onBlur={(e) => handleSave(setting, `"${e.target.value}"`)}
            className="w-24 h-12"
          />
          <Input
            type="text"
            defaultValue={value}
            onBlur={(e) => handleSave(setting, `"${e.target.value}"`)}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      );
    }

    if (setting.key.includes("title") || setting.key.includes("subtitle") || setting.key.includes("tagline")) {
      return (
        <Textarea
          defaultValue={value}
          onBlur={(e) => handleSave(setting, `"${e.target.value}"`)}
          rows={3}
        />
      );
    }

    return (
      <Input
        defaultValue={value}
        onBlur={(e) => handleSave(setting, `"${e.target.value}"`)}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const publicSettings = settings.filter((s) => s.category === "public");

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
          ← Voltar ao Admin
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Configurações do Frontend
        </h1>
        <p className="text-slate-600">
          Personalize a aparência e conteúdo da landing page
        </p>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding">Marca</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="contact">Contacto</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identidade da Marca</CardTitle>
              <CardDescription>
                Configure o nome, cores e identidade visual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {publicSettings
                .filter((s) => ["app_name", "app_tagline", "primary_color", "secondary_color"].includes(s.key))
                .map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      {setting.description || setting.key}
                    </label>
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo da Página</CardTitle>
              <CardDescription>
                Edite os textos da hero section e outros conteúdos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {publicSettings
                .filter((s) => ["hero_title", "hero_subtitle"].includes(s.key))
                .map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      {setting.description || setting.key}
                    </label>
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações de Contacto</CardTitle>
              <CardDescription>
                Configure os dados de contacto exibidos no site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {publicSettings
                .filter((s) => ["contact_email", "contact_phone", "company_address"].includes(s.key))
                .map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      {setting.description || setting.key}
                    </label>
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          💡 Dica
        </h3>
        <p className="text-blue-800 text-sm">
          As alterações são aplicadas automaticamente ao clicar fora do campo. 
          Visite a <a href="/landing" target="_blank" className="underline font-medium">landing page</a> para ver as alterações.
        </p>
      </div>
    </div>
  );
}