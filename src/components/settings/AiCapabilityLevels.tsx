import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CAPABILITY_LABELS,
  CAPABILITY_DESCRIPTIONS,
  DEFAULT_CAPABILITY_LEVELS,
  type AiCapability,
  type AiCapabilityLevel,
} from "@/lib/server/aiActions";

/**
 * Nível de autonomia da IA por capacidade.
 *
 * Desligado — a IA nem sequer propõe.
 * Propor    — fica à espera de aprovação na caixa de entrada do assistente.
 * Automático— aplica logo, mas fica registado e é reversível.
 */

const CAPABILITIES: AiCapability[] = [
  "lead_qualification",
  "lead_temperature",
  "lead_status",
  "task_create",
  "calendar_block",
];

const LEVEL_LABELS: Record<AiCapabilityLevel, string> = {
  off: "Desligado",
  propose: "Propor",
  auto: "Automático",
};

interface AiCapabilityLevelsProps {
  profile: any;
  onProfileChange: (updater: (prev: any) => any) => void;
}

export function AiCapabilityLevels({ profile, onProfileChange }: AiCapabilityLevelsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const levels = (profile?.ai_capability_levels || {}) as Record<string, AiCapabilityLevel>;

  const levelFor = (capability: AiCapability): AiCapabilityLevel =>
    levels[capability] || DEFAULT_CAPABILITY_LEVELS[capability];

  const handleChange = async (capability: AiCapability, level: AiCapabilityLevel) => {
    setSaving(capability);
    const next = { ...levels, [capability]: level };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const { error } = await supabase
        .from("profiles")
        .update({ ai_capability_levels: next } as any)
        .eq("id", user.id);
      if (error) throw error;

      onProfileChange((prev: any) => (prev ? { ...prev, ai_capability_levels: next } : prev));
      toast({ title: "Nível atualizado", description: CAPABILITY_LABELS[capability] });
    } catch (error) {
      toast({
        title: "Erro ao guardar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autonomia da IA</CardTitle>
        <CardDescription>
          Por defeito a IA trata do trabalho interno sozinha — tudo o que faz fica registado no
          Assistente IA e pode ser desfeito. Se preferires validar antes, põe a capacidade em
          &quot;Propor&quot; e ela passa a esperar pela tua aprovação; &quot;Desligado&quot; impede-a
          por completo. Ações que saem para o cliente (emails, mensagens) nunca são automáticas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CAPABILITIES.map((capability) => (
          <div
            key={capability}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1 pr-4">
              <Label className="text-base font-medium">{CAPABILITY_LABELS[capability]}</Label>
              <p className="text-sm text-muted-foreground">
                {CAPABILITY_DESCRIPTIONS[capability]}
              </p>
            </div>
            <Select
              value={levelFor(capability)}
              disabled={saving === capability}
              onValueChange={(value) => handleChange(capability, value as AiCapabilityLevel)}
            >
              <SelectTrigger className="w-full sm:w-44 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">{LEVEL_LABELS.off}</SelectItem>
                <SelectItem value="propose">{LEVEL_LABELS.propose}</SelectItem>
                <SelectItem value="auto">{LEVEL_LABELS.auto}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
