import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";

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
  const [form, setForm] = useState({
    document_cover_title: profile?.document_cover_title || "",
    document_about_me: profile?.document_about_me || "",
    document_closing_text: profile?.document_closing_text || "",
    ami_license: profile?.ami_license || "",
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

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
