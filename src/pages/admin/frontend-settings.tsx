import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Mail, Phone, MapPin, FileText, BarChart3 } from "lucide-react";
import {
  getFrontendSettings,
  updateFrontendSettings,
  type FrontendSettings,
} from "@/services/frontendSettingsService";
import { LeadColumnsSettings } from "@/components/admin/LeadColumnsSettings";

// Uma entrada por cada página estática pública — o slug identifica o
// sufixo das chaves em frontend_settings (seo_title_<slug>,
// seo_description_<slug>, heading_<slug>), criadas na migração
// 20260711160000_fix_frontend_settings_admin_role_and_seed_pages.sql.
// hasIntro: páginas de marketing que têm um parágrafo de introdução editável
// por baixo do título. As páginas legais não têm (o conteúdo é jurídico).
const STATIC_PAGES: Array<{ slug: string; label: string; path: string; hasIntro?: boolean }> = [
  { slug: "about", label: "Sobre Nós", path: "/about", hasIntro: true },
  { slug: "contact", label: "Contacto", path: "/contact", hasIntro: true },
  { slug: "pricing", label: "Preços", path: "/pricing", hasIntro: true },
  { slug: "use_cases", label: "Casos de Uso", path: "/use-cases", hasIntro: true },
  { slug: "faq", label: "FAQ", path: "/faq", hasIntro: true },
  { slug: "documentation", label: "Documentação", path: "/documentation", hasIntro: true },
  { slug: "support", label: "Suporte", path: "/support", hasIntro: true },
  { slug: "features", label: "Funcionalidades", path: "/features", hasIntro: true },
  { slug: "privacy_policy", label: "Política de Privacidade", path: "/privacy-policy" },
  { slug: "terms_of_service", label: "Termos de Serviço", path: "/terms-of-service" },
  { slug: "data_deletion", label: "Eliminação de Dados", path: "/data-deletion" },
  { slug: "informacao_legal", label: "Informação Legal", path: "/informacao-legal" },
];

export default function FrontendSettingsPage() {
  const [settings, setSettings] = useState<FrontendSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const setField = (key: string, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
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
              <p className="text-gray-500 mt-1">Personalize os textos e o contacto mostrados no site público</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : "Guardar Alterações"}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Marca</CardTitle>
              <CardDescription>Nome e slogan mostrados na página inicial</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app_name">Nome da Aplicação</Label>
                <Input
                  id="app_name"
                  value={settings.app_name || ""}
                  onChange={(e) => setField("app_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app_tagline">Slogan</Label>
                <Input
                  id="app_tagline"
                  value={settings.app_tagline || ""}
                  onChange={(e) => setField("app_tagline", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contactos</CardTitle>
              <CardDescription>Usados em várias páginas do site (contacto, política de privacidade, eliminação de dados)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email de Contacto
                </Label>
                <Input
                  id="contact_email"
                  value={settings.contact_email || ""}
                  onChange={(e) => setField("contact_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privacy_email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email de Privacidade/RGPD
                </Label>
                <Input
                  id="privacy_email"
                  value={settings.privacy_email || ""}
                  onChange={(e) => setField("privacy_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Label>
                <Input
                  id="contact_phone"
                  value={settings.contact_phone || ""}
                  onChange={(e) => setField("contact_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Morada
                </Label>
                <Input
                  id="company_address"
                  value={settings.company_address || ""}
                  onChange={(e) => setField("company_address", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identificação Legal do Vendedor</CardTitle>
              <CardDescription>
                Mostrados na página pública "Informação Legal" (/informacao-legal) — obrigatórios para venda
                online: denominação fiscal, NIF e entidade de resolução de litígios. A morada, telefone e email
                usados são os dos Contactos acima.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legal_company_name">Denominação Fiscal</Label>
                <Input
                  id="legal_company_name"
                  value={settings.legal_company_name || ""}
                  onChange={(e) => setField("legal_company_name", e.target.value)}
                  placeholder="Ex: Vyxa, Unipessoal Lda."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_nif">NIF</Label>
                <Input
                  id="legal_nif"
                  value={settings.legal_nif || ""}
                  onChange={(e) => setField("legal_nif", e.target.value)}
                  placeholder="Ex: 500 000 000"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legal_arbitration_center">Centro de Arbitragem / Entidade RAL competente</Label>
                <Input
                  id="legal_arbitration_center"
                  value={settings.legal_arbitration_center || ""}
                  onChange={(e) => setField("legal_arbitration_center", e.target.value)}
                  placeholder="Ex: CACCL — Centro de Arbitragem de Conflitos de Consumo de Lisboa — www.centroarbitragemlisboa.pt"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tracking (Google &amp; Meta)
              </CardTitle>
              <CardDescription>
                Mede o tráfego que chega ao site público a partir de campanhas — só é ativado nas
                páginas de marketing e captação (landing, preços, páginas de lead por token, etc.),
                nunca dentro da aplicação autenticada. Deixe em branco para não ativar.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tracking_ga_measurement_id">Google Analytics 4 — Measurement ID</Label>
                <Input
                  id="tracking_ga_measurement_id"
                  value={settings.tracking_ga_measurement_id || ""}
                  onChange={(e) => setField("tracking_ga_measurement_id", e.target.value.trim())}
                  placeholder="G-XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">Admin › Fluxos de dados, no Google Analytics.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking_meta_pixel_id">Meta Pixel — ID do Pixel</Label>
                <Input
                  id="tracking_meta_pixel_id"
                  value={settings.tracking_meta_pixel_id || ""}
                  onChange={(e) => setField("tracking_meta_pixel_id", e.target.value.trim())}
                  placeholder="000000000000000"
                />
                <p className="text-xs text-muted-foreground">Gestor de Eventos, no Meta Business Suite.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Páginas do Site
              </CardTitle>
              <CardDescription>
                Título e descrição mostrados na aba do browser/Google, e o título principal de cada página. Deixe em
                branco para manter o texto atual definido no código.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {STATIC_PAGES.map((page) => (
                  <AccordionItem key={page.slug} value={page.slug}>
                    <AccordionTrigger>
                      {page.label} <span className="text-xs text-muted-foreground ml-2">{page.path}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
                      <div className="space-y-2">
                        <Label htmlFor={`seo_title_${page.slug}`}>Título da Aba (SEO)</Label>
                        <Input
                          id={`seo_title_${page.slug}`}
                          value={settings[`seo_title_${page.slug}`] || ""}
                          onChange={(e) => setField(`seo_title_${page.slug}`, e.target.value)}
                          placeholder="Ex: Sobre Nós - Vyxa One CRM"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`seo_description_${page.slug}`}>Descrição (SEO)</Label>
                        <Input
                          id={`seo_description_${page.slug}`}
                          value={settings[`seo_description_${page.slug}`] || ""}
                          onChange={(e) => setField(`seo_description_${page.slug}`, e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`heading_${page.slug}`}>Título Principal da Página</Label>
                        <Input
                          id={`heading_${page.slug}`}
                          value={settings[`heading_${page.slug}`] || ""}
                          onChange={(e) => setField(`heading_${page.slug}`, e.target.value)}
                        />
                      </div>
                      {page.hasIntro && (
                        <div className="space-y-2">
                          <Label htmlFor={`intro_${page.slug}`}>Texto de Introdução</Label>
                          <Textarea
                            id={`intro_${page.slug}`}
                            value={settings[`intro_${page.slug}`] || ""}
                            onChange={(e) => setField(`intro_${page.slug}`, e.target.value)}
                            rows={2}
                            placeholder="Frase mostrada por baixo do título principal"
                          />
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <LeadColumnsSettings />
        </div>
      </ProtectedRoute>
    </Layout>
  );
}
