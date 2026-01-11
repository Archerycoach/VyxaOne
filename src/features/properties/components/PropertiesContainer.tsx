import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PropertiesList } from "@/components/properties/PropertiesList";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { getProperties } from "@/services/propertiesService";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/types";

export function PropertiesContainer() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data as unknown as Property[]);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os imóveis",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setSelectedProperty(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    fetchProperties();
    setIsFormOpen(false);
    setSelectedProperty(null);
  };

  const handleFormOpenChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) setSelectedProperty(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie o seu portfólio de propriedades.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Imóvel
        </Button>
      </div>

      <PropertiesList 
        properties={properties}
        onEdit={handleEdit}
        onRefresh={fetchProperties}
      />
      
      <PropertyForm
        property={selectedProperty}
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}