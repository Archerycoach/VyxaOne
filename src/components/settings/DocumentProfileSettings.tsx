import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";
import { DocumentAssetUpload } from "./DocumentAssetUpload";

/**
 * Textos das folhas de rosto e de fim dos documentos entregues ao cliente
 * (avaliação de mercado, simulação de financiamento).
 *
 * Escritos pelo consultor, não gerados por IA: é uma apresentação pessoal,
 * com credenciais e percurso próprios. Um modelo inventaria experiência e
 * prémios que a pessoa não tem, num documento que vai à frente do cliente.
 */

const ABOUT_ME_PLACEHOLDER = `Ex.:

Acompanho clientes no mercado imobiliário da região de Lisboa há 8 anos, com
foco em habitação familiar.

O que me distingue:
• Rigor na avaliação — apresento sempre dados de mercado verificáveis.
• Disponibilidade — respondo no próprio dia.
• Acompanhamento até à escritura, sem intermediários.`;

const CLOSING_PLACEHOLDER = `Ex.:

Obrigado pela confiança em analisar este documento.

Fico ao dispor para esclarecer qualquer questão ou avançar para uma visita.
O próximo passo é seu — e estarei presente em cada etapa.`;

interface DocumentProfileSettingsProps {
  profile: any;
  onProfileChange: (updater: (prev: any) => any) => void;
}

export function DocumentProfileSettings({ profile, onProfileChange }: DocumentProfileSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState({
    document_cover_pdf_path: (profile?.document_cover_pdf_path as string) || null,
    document_about_pdf_path: (profile?.document_about_pdf_path as string) || null,
    document_closing_pdf_path: (profile?.document_closing_pdf_path as string) || null,
    document_footer_image_path: (profile?.document_footer_image_path as string) || null,
  });
  const [form, setForm] = useState({
    document_cover_title: profile?.document_cover_title || "",
    document_about_me: profile?.document_about_me || "",
    document_closing_text: profile?.document_closing_text || "",
    ami_license: profile?.ami_license || "",
    document_brand_color: profile?.document_brand_color || "",
    document_accent_color: profile?.document_accent_color || "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const { error } = await supabase
        .from("profiles")
        .update(form as any)
        .eq("id", user.id);
      if (error) throw error;

      onProfileChange((prev: any) => (prev ? { ...prev, ...form } : prev));
      toast({
        title: "Guardado",
        description: "Os documentos passam a usar estes textos.",
      });
    } catch (error) {
      toast({
        title: "Erro ao guardar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentos para o cliente
        </CardTitle>
        <CardDescription>
          As avaliações de mercado e simulações de financiamento são entregues com uma capa de
          apresentação e uma folha de fecho. Escreve aqui esses textos — aparecem em todos os
          documentos que gerares, com o teu nome e contactos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-cover-title">Subtítulo da capa</Label>
            <Input
              id="doc-cover-title"
              value={form.document_cover_title}
              onChange={(e) => setForm({ ...form, document_cover_title: e.target.value })}
              placeholder="Consultor Imobiliário · Lisboa"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-ami">Licença AMI</Label>
            <Input
              id="doc-ami"
              value={form.ami_license}
              onChange={(e) => setForm({ ...form, ami_license: e.target.value })}
              placeholder="AMI 12345"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-about">Apresentação (folha de rosto)</Label>
          <p className="text-xs text-muted-foreground">
            Quem és, o teu percurso e o que te distingue. É a primeira coisa que o cliente lê.
          </p>
          <Textarea
            id="doc-about"
            rows={9}
            value={form.document_about_me}
            onChange={(e) => setForm({ ...form, document_about_me: e.target.value })}
            placeholder={ABOUT_ME_PLACEHOLDER}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-closing">Mensagem de fecho (última página)</Label>
          <p className="text-xs text-muted-foreground">
            O que dizes ao cliente depois de ele ver os números. Um convite claro para o próximo passo.
          </p>
          <Textarea
            id="doc-closing"
            rows={6}
            value={form.document_closing_text}
            onChange={(e) => setForm({ ...form, document_closing_text: e.target.value })}
            placeholder={CLOSING_PLACEHOLDER}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Se deixares em branco, o documento é gerado sem essas páginas — nada é inventado
          automaticamente.
        </p>

        {/* Cores do documento. Aplicam-se à faixa da capa, aos títulos de
            secção e ao destaque do preço recomendado. */}
        <div className="space-y-3 border-t pt-6">
          <div>
            <h4 className="font-medium">Cores do documento</h4>
            <p className="text-xs text-muted-foreground">
              Usa as cores da tua agência. Em branco, ficam as cores por omissão.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-brand">Cor principal</Label>
              <div className="flex items-center gap-2">
                <input
                  id="doc-brand"
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded border"
                  value={form.document_brand_color || "#1c2b33"}
                  onChange={(e) => setForm({ ...form, document_brand_color: e.target.value })}
                />
                <Input
                  value={form.document_brand_color || ""}
                  onChange={(e) => setForm({ ...form, document_brand_color: e.target.value })}
                  placeholder="#1c2b33"
                />
              </div>
              <p className="text-xs text-muted-foreground">Faixa da capa e títulos.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-accent">Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  id="doc-accent"
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded border"
                  value={form.document_accent_color || "#2563eb"}
                  onChange={(e) => setForm({ ...form, document_accent_color: e.target.value })}
                />
                <Input
                  value={form.document_accent_color || ""}
                  onChange={(e) => setForm({ ...form, document_accent_color: e.target.value })}
                  placeholder="#2563eb"
                />
              </div>
              <p className="text-xs text-muted-foreground">Filetes e preço recomendado.</p>
            </div>
          </div>
        </div>

        {/* Identidade visual própria. Gravam de imediato (não dependem do
            botão Guardar), porque o carregamento já é a confirmação. */}
        <div className="space-y-4 border-t pt-6">
          <div>
            <h4 className="font-medium">Ficheiros próprios</h4>
            <p className="text-xs text-muted-foreground">
              Se tens material gráfico da agência, usa-o. Substitui o que a aplicação desenha.
            </p>
          </div>

          <DocumentAssetUpload
            label="Capa (PDF)"
            description="Substitui a capa gerada. Todas as páginas do PDF são usadas, pela ordem em que estão."
            kind="pdf"
            column="document_cover_pdf_path"
            value={assets.document_cover_pdf_path}
            onChange={(path) =>
              setAssets((prev) => ({ ...prev, document_cover_pdf_path: path }))
            }
          />

          <DocumentAssetUpload
            label="Apresentação (PDF)"
            description="Substitui a folha 'Quem eu sou'. Entra logo a seguir à capa."
            kind="pdf"
            column="document_about_pdf_path"
            value={assets.document_about_pdf_path}
            onChange={(path) =>
              setAssets((prev) => ({ ...prev, document_about_pdf_path: path }))
            }
          />

          <DocumentAssetUpload
            label="Contracapa (PDF)"
            description="Acrescentada no fim do documento, depois da mensagem de fecho."
            kind="pdf"
            column="document_closing_pdf_path"
            value={assets.document_closing_pdf_path}
            onChange={(path) =>
              setAssets((prev) => ({ ...prev, document_closing_pdf_path: path }))
            }
          />

          <DocumentAssetUpload
            label="Faixa de rodapé (imagem)"
            description="Repetida no fundo de todas as páginas de conteúdo. Use uma imagem larga e baixa (ex.: 1600×140 px)."
            kind="image"
            column="document_footer_image_path"
            value={assets.document_footer_image_path}
            onChange={(path) =>
              setAssets((prev) => ({ ...prev, document_footer_image_path: path }))
            }
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
