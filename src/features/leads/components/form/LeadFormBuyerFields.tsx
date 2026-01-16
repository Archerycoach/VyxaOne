import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadFormBuyerFieldsProps {
  formData: {
    property_type: string;
    bedrooms: string;
    min_area: string;
    budget: string;
    location_preference: string;
    needs_financing: boolean;
    is_development?: boolean;
    development_name?: string;
  };
  onChange: (field: string, value: any) => void;
}

export function LeadFormBuyerFields({ formData, onChange }: LeadFormBuyerFieldsProps) {
  return (
    <div className="space-y-4 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
      <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-200 pb-2 flex items-center gap-2">
        <span className="text-xl">🏠</span>
        Informação do Comprador
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="property_type">Tipo de Imóvel Pretendido</Label>
          <Select
            value={formData.property_type}
            onValueChange={(value) => onChange("property_type", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">Apartamento</SelectItem>
              <SelectItem value="house">Moradia</SelectItem>
              <SelectItem value="land">Terreno</SelectItem>
              <SelectItem value="commercial">Comercial</SelectItem>
              <SelectItem value="office">Escritório</SelectItem>
              <SelectItem value="warehouse">Armazém</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bedrooms">Número de Quartos (Pretendido)</Label>
          <Input
            id="bedrooms"
            type="number"
            min="0"
            value={formData.bedrooms}
            onChange={(e) => onChange("bedrooms", e.target.value)}
            placeholder="Ex: 2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min_area">Área Mínima Pretendida (m²)</Label>
          <Input
            id="min_area"
            type="number"
            min="0"
            value={formData.min_area}
            onChange={(e) => onChange("min_area", e.target.value)}
            placeholder="Ex: 80"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget">Orçamento Máximo</Label>
          <CurrencyInput
            id="budget"
            value={formData.budget}
            onValueChange={(value) => onChange("budget", value.toString())}
            placeholder="Ex: 250.000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="buyer_location_preference">Localização Preferida (para Compra)</Label>
          <Input
            id="buyer_location_preference"
            value={formData.location_preference}
            onChange={(e) => onChange("location_preference", e.target.value)}
            placeholder="Ex: Lisboa, Cascais, Oeiras"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="needs_financing" className="flex items-center gap-2">
            <input
              type="checkbox"
              id="needs_financing"
              checked={formData.needs_financing}
              onChange={(e) => onChange("needs_financing", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Vai recorrer a crédito?
          </Label>
          <p className="text-xs text-gray-500">Marque se o comprador precisa de financiamento</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="is_development" className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_development"
              checked={formData.is_development || false}
              onChange={(e) => onChange("is_development", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Empreendimento
          </Label>
          <p className="text-xs text-gray-500">Marque se procura imóvel em empreendimento específico</p>
        </div>

        {formData.is_development && (
          <div className="space-y-2">
            <Label htmlFor="development_name">Nome do Empreendimento</Label>
            <Input
              id="development_name"
              value={formData.development_name || ""}
              onChange={(e) => onChange("development_name", e.target.value)}
              placeholder="Ex: Empreendimento Vista Mar"
            />
          </div>
        )}
      </div>
    </div>
  );
}