import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBuyerStages, getSellerStages, PipelineStage } from "@/services/pipelineSettingsService";

interface LeadFormBasicFieldsProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    lead_type: string;
    status: string;
    source: string;
  };
  onChange: (field: string, value: any) => void;
}

export function LeadFormBasicFields({ formData, onChange }: LeadFormBasicFieldsProps) {
  const [availableStatuses, setAvailableStatuses] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);

  // Load pipeline stages based on lead_type
  useEffect(() => {
    const loadPipelineStages = async () => {
      setLoading(true);
      try {
        let stages: PipelineStage[] = [];

        if (formData.lead_type === "buyer") {
          // Only buyer stages
          stages = await getBuyerStages();
        } else if (formData.lead_type === "seller") {
          // Only seller stages
          stages = await getSellerStages();
        } else if (formData.lead_type === "both") {
          // Both buyer and seller stages
          const buyerStages = await getBuyerStages();
          const sellerStages = await getSellerStages();
          
          // Combine with labels to distinguish
          stages = [
            ...buyerStages.map(s => ({ ...s, name: `🏠 ${s.name}` })),
            ...sellerStages.map(s => ({ ...s, name: `🏡 ${s.name}` }))
          ];
        }

        setAvailableStatuses(stages);

        // If current status is not in the new list, reset it
        if (formData.status && !stages.some(s => s.id === formData.status)) {
          onChange("status", stages.length > 0 ? stages[0].id : "new");
        }
      } catch (error) {
        console.error("Error loading pipeline stages:", error);
      } finally {
        setLoading(false);
      }
    };

    if (formData.lead_type) {
      loadPipelineStages();
    }
  }, [formData.lead_type]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Informação Básica</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Nome completo"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="+351912345678 (9-15 dígitos)"
          />
          <p className="text-xs text-gray-500">Formato: +351912345678 (espaços e caracteres especiais serão removidos automaticamente)</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="email@exemplo.com"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lead_type">Tipo *</Label>
          <Select
            value={formData.lead_type}
            onValueChange={(value) => onChange("lead_type", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">Comprador</SelectItem>
              <SelectItem value="seller">Vendedor</SelectItem>
              <SelectItem value="both">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado do Pipeline</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => onChange("status", value)}
            disabled={!formData.lead_type || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Carregando..." : "Selecione estado"} />
            </SelectTrigger>
            <SelectContent>
              {availableStatuses.length === 0 && !loading && (
                <SelectItem value="none" disabled>Selecione primeiro o tipo de lead</SelectItem>
              )}
              {availableStatuses.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.lead_type === "both" && (
            <p className="text-xs text-gray-500">
              🏠 = Estado de comprador | 🏡 = Estado de vendedor
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="source">Origem</Label>
          <Select
            value={formData.source}
            onValueChange={(value) => onChange("source", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="referral">Referência</SelectItem>
              <SelectItem value="social_media">Redes Sociais</SelectItem>
              <SelectItem value="cold_call">Prospeção</SelectItem>
              <SelectItem value="event">Evento</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}