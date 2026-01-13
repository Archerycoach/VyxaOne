import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Eye, Palette } from "lucide-react";
import {
  getFrontendSettings,
  updateFrontendSettings,
  uploadLogo,
  type FrontendSettings,
} from "@/services/frontendSettingsService";
import { LeadColumnsSettings } from "@/components/admin/LeadColumnsSettings";

export default function FrontendSettingsPage() {
  const [settings, setSettings] = useState<FrontendSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getFrontendSettings();
      setSettings(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar configurações",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      await updateFrontendSettings(settings);
      toast({
        title: "Configurações guardadas",
        description: "As configurações do frontend foram atualizadas com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao guardar configurações",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      const logoUrl = await uploadLogo(file);
      setSettings((prev) => (prev ? { ...prev, logo_url: logoUrl } : null));
      toast({
        title: "Logo carregado",
        description: "O logo foi carregado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar logo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <ProtectedRoute allowedRoles={["admin"]}>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </ProtectedRoute>
      </Layout>
    );
  }

  if (!settings) return null;

  return (
    <Layout>
      <ProtectedRoute allowedRoles={["admin"]}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Configurações do Frontend</h1>
              <p className="text-gray-500 mt-1">Personalize a aparência do sistema</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Alterações
            </Button>
          </div>

          {/* Existing frontend settings sections... */}

          {/* NEW: Lead Columns Configuration */}
          <LeadColumnsSettings />
        </div>
      </ProtectedRoute>
    </Layout>
  );
}