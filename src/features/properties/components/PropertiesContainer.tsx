import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { PropertiesList } from "@/components/properties/PropertiesList";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { getProperties } from "@/services/propertiesService";
import { indexAllProperties } from "@/services/semanticSearchService";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/types";

export function PropertiesContainer() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [indexing, setIndexing] = useState(false);

  /**
   * Indexa a carteira para a pesquisa semântica. Só é preciso correr uma vez
   * (os imóveis novos/editados são indexados automaticamente ao guardar), e
   * imóveis inalterados são ignorados, por isso repetir não custa nada.
   */
  const handleIndexAll = async () => {
    setIndexing(true);
    try {
      const result = await indexAllProperties();
      toast({
        title: "Indexação concluída",
        description:
          `${result.indexed} imóvel(is) indexado(s), ${result.skipped} sem alterações` +
          (result.failed ? `, ${result.failed} com erro` : "") + ".",
      });
    } catch (error) {
      toast({
        title: "Erro ao indexar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIndexing(false);
    }
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleIndexAll} disabled={indexing}>
            {indexing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {indexing ? "A indexar…" : "Indexar para pesquisa IA"}
          </Button>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Imóvel
          </Button>
        </div>
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