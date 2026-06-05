import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Home, MapPin, Bed, Maximize, Euro, ExternalLink, StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLinksNote } from "@/services/idealistaService";
import type { IdealistaProperty } from "@/services/idealistaService";

interface IdealistaSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
}

export function IdealistaSearchDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
}: IdealistaSearchDialogProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<IdealistaProperty[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch("/api/idealista/search-for-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ leadId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao pesquisar imóveis");
      }

      const data = await response.json();
      setProperties(data.properties || []);

      if (!data.properties || data.properties.length === 0) {
        toast({
          title: "Nenhum imóvel encontrado",
          description: "Não foram encontrados imóveis que correspondam ao perfil desta lead.",
        });
      } else {
        toast({
          title: "Pesquisa concluída!",
          description: `Encontrados ${data.properties.length} imóveis no Idealista.`,
        });
      }
    } catch (error: any) {
      console.error("Erro ao pesquisar imóveis:", error);
      toast({
        title: "Erro na pesquisa",
        description: error.message || "Não foi possível pesquisar imóveis no Idealista.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLinksAsNote = async () => {
    if (properties.length === 0) return;
    
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const linksNote = formatPropertyLinksNote(properties);
      
      const { error } = await supabase.from("lead_notes" as any).insert({
        lead_id: leadId,
        note: linksNote,
        user_id: user.id,
        created_at: new Date().toISOString()
      } as any);

      if (error) throw error;

      toast({
        title: "Links guardados!",
        description: "Os links dos imóveis foram adicionados como nota privada na lead.",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao guardar nota:", error);
      toast({
        title: "Erro",
        description: "Não foi possível guardar os links como nota.",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-purple-600" />
            Pesquisar Imóveis no Idealista - {leadName}
          </DialogTitle>
          <DialogDescription>
            Pesquise imóveis no Idealista baseados nos dados desta lead (tipologia, localização, orçamento, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {properties.length === 0 ? (
            <div className="text-center py-12">
              <Home className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                Clique no botão abaixo para pesquisar imóveis correspondentes a esta lead
              </p>
              <Button onClick={handleSearch} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    A pesquisar...
                  </>
                ) : (
                  <>
                    <Home className="w-5 h-5 mr-2" />
                    Pesquisar no Idealista
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Encontrados <strong>{properties.length}</strong> imóveis
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSearch} disabled={loading}>
                    <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Pesquisar novamente
                  </Button>
                  <Button onClick={handleSaveLinksAsNote} disabled={savingNote}>
                    {savingNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        A guardar...
                      </>
                    ) : (
                      <>
                        <StickyNote className="w-4 h-4 mr-2" />
                        Guardar Links como Nota
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {properties.map((property) => (
                  <div
                    key={property.propertyCode}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      {/* Imagem */}
                      <div className="w-48 h-36 flex-shrink-0">
                        <img
                          src={property.thumbnail}
                          alt={property.suggestedTexts?.title || "Imóvel"}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>

                      {/* Detalhes */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-lg">
                            {property.suggestedTexts?.title || property.propertyType}
                          </h4>
                          <Badge variant="secondary" className="ml-2">
                            {property.operation === "sale" ? "Venda" : "Arrendamento"}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {property.suggestedTexts?.subtitle || property.address}
                        </p>

                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {property.municipality}, {property.district}
                          </div>
                          <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            {property.rooms} quartos
                          </div>
                          <div className="flex items-center gap-1">
                            <Maximize className="w-4 h-4" />
                            {property.size}m²
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1 text-lg font-bold text-purple-600">
                            <Euro className="w-5 h-5" />
                            {property.price.toLocaleString("pt-PT")}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(property.url, "_blank")}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Ver no Idealista
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}