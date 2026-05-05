import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DevelopmentForm } from "@/components/developments/DevelopmentForm";
import { DevelopmentsList } from "@/components/developments/DevelopmentsList";
import { useToast } from "@/hooks/use-toast";
import { getDevelopments } from "@/services/developmentsService";
import type { Development } from "@/types";

export function DevelopmentsContainer() {
  const { toast } = useToast();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevelopment, setSelectedDevelopment] = useState<Development | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchDevelopments = async () => {
    try {
      const data = await getDevelopments();
      setDevelopments(data);
    } catch (error) {
      console.error("Error fetching developments:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os empreendimentos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDevelopments();
  }, []);

  const handleNew = () => {
    setSelectedDevelopment(null);
    setIsFormOpen(true);
  };

  const handleEdit = (development: Development) => {
    setSelectedDevelopment(development);
    setIsFormOpen(true);
  };

  const handleSuccess = () => {
    void fetchDevelopments();
    setSelectedDevelopment(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empreendimentos</h1>
          <p className="mt-2 text-muted-foreground">
            Gere lançamentos e projetos com data de publicação, tipologias e preços base.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Empreendimento
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">
          A carregar empreendimentos...
        </Card>
      ) : (
        <DevelopmentsList
          developments={developments}
          onEdit={handleEdit}
          onRefresh={fetchDevelopments}
        />
      )}

      <DevelopmentForm
        development={selectedDevelopment}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}