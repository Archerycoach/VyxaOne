import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";

interface LeadFormSellerFieldsProps {
  formData: {
    location_preference: string;
    bedrooms: string;
    bathrooms: string;
    property_area: string;
    desired_price: string;
    lead_type: string;
  };
  onChange: (field: string, value: any) => void;
}

export function LeadFormSellerFields({ formData, onChange }: LeadFormSellerFieldsProps) {
  // Check if this is a "both" type lead to adjust field labels
  const isBothType = formData.lead_type === "both";
  
  return (
    <div className="space-y-4 bg-green-50 p-4 rounded-lg border-2 border-green-200">
      <h3 className="text-lg font-semibold text-green-900 border-b border-green-200 pb-2 flex items-center gap-2">
        <span className="text-xl">🏡</span>
        Informação do Vendedor
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {!isBothType && (
          <div className="space-y-2">
            <Label htmlFor="seller_location">Localização do Imóvel</Label>
            <Input
              id="seller_location"
              value={formData.location_preference}
              onChange={(e) => onChange("location_preference", e.target.value)}
              placeholder="Ex: Rua X, Lisboa"
            />
          </div>
        )}

        {isBothType && (
          <div className="space-y-2">
            <Label htmlFor="seller_location_both">Localização do Imóvel a Vender</Label>
            <Input
              id="seller_location_both"
              value={formData.location_preference}
              onChange={(e) => onChange("location_preference", e.target.value)}
              placeholder="Ex: Rua X, Lisboa"
            />
            <p className="text-xs text-gray-500">
              💡 Se já preencheu a localização pretendida para compra acima, esta é a localização do imóvel que vende
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="seller_bedrooms">
            {isBothType ? "Quartos do Imóvel a Vender" : "Número de Quartos"}
          </Label>
          <Input
            id="seller_bedrooms"
            type="number"
            min="0"
            value={formData.bedrooms}
            onChange={(e) => onChange("bedrooms", e.target.value)}
            placeholder="Ex: 3"
          />
          {isBothType && (
            <p className="text-xs text-gray-500">
              ⚠️ Isto sobrescreve o valor de quartos pretendidos para compra
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bathrooms">Número de Casas de Banho</Label>
          <Input
            id="bathrooms"
            type="number"
            min="0"
            value={formData.bathrooms}
            onChange={(e) => onChange("bathrooms", e.target.value)}
            placeholder="Ex: 2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="property_area">Área do Imóvel (m²)</Label>
          <Input
            id="property_area"
            type="number"
            min="0"
            value={formData.property_area}
            onChange={(e) => onChange("property_area", e.target.value)}
            placeholder="Ex: 120"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desired_price">Preço Pretendido (Venda)</Label>
        <CurrencyInput
          id="desired_price"
          value={formData.desired_price}
          onValueChange={(value) => onChange("desired_price", value.toString())}
          placeholder="Ex: 350.000"
        />
      </div>
    </div>
  );
}