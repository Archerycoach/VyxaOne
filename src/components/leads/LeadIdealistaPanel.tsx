import { useState } from "react";
import { Bot, ExternalLink, Home, Loader2, MapPin, Bed, Maximize, Euro, StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLinksNote } from "@/services/idealistaService";
import type { IdealistaProperty } from "@/services/idealistaService";
import type { LeadWithContacts } from "@/services/leadsService";

interface LeadIdealistaPanelProps {
  lead: LeadWithContacts;
}

export function LeadIdealistaPanel({ lead }: LeadIdealistaPanelProps) {
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [properties, setProperties] = useState<IdealistaProperty[]>([]);
  const { toast } = useToast();

  const canSearch =
    lead.lead_type === "buyer" || lead.lead_type === "both";

  const summaryItems = [
    lead.location_preference ? { label: "Zona", value: lead.location_preference } : null,
    lead.property_type ? { label: "Tipologia", value: lead.property_type } : null,
    lead.bedrooms ? { label: "Quartos", value: String(lead.bedrooms) } : null,
    lead.min_area ? { label: "Área mín.", value: `${lead.min_area}m²` } : null,
    lead.budget_max
      ? {
          label: "Budget máx.",
          value: new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(lead.budget_max),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const handleSearch = async () => {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch("/api/idealista/search-for-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao pesquisar imóveis");
      }

      const nextProperties = Array.isArray(data.properties) ? data.properties : [];
      setProperties(nextProperties);

      toast({
        title: nextProperties.length > 0 ? "Pesquisa concluída" : "Sem resultados",
        description:
          nextProperties.length > 0
            ? `Foram encontrados ${nextProperties.length} imóveis adaptados a esta lead.`
            : "Não foram encontrados imóveis com este perfil no Idealista.",
      });
    } catch (error: any) {
      toast({
        title: "Erro na pesquisa",
        description:
          error.message || "Não foi possível pesquisar imóveis no Idealista.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLinksAsNote = async () => {
    if (properties.length === 0) {
      return;
    }

    setSavingNote(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Não autenticado");
      }

      const linksNote = formatPropertyLinksNote(properties);

      const { error } = await supabase.from("lead_notes" as any).insert({
        lead_id: lead.id,
        note: linksNote,
        user_id: user.id,
        created_at: new Date().toISOString(),
      } as any);

      if (error) {
        throw error;
      }

      toast({
        title: "Links guardados",
        description: "Os imóveis encontrados foram adicionados como nota privada.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao guardar",
        description:
          error.message || "Não foi possível guardar os links como nota.",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  if (!canSearch) {
    return null;
  }

  return (
    <Card className="border-purple-200 bg-purple-50/40">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5 text-purple-700" />
          Painel IA · Pesquisa assistida no Idealista
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A IA usa os dados reais desta lead para procurar imóveis adaptados sem sair da ficha.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {summaryItems.length > 0 ? (
            summaryItems.map((item) => (
              <Badge key={item.label} variant="outline" className="bg-white">
                <span className="font-medium mr-1">{item.label}:</span>
                {item.value}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta lead ainda tem poucos critérios. A pesquisa pode ficar demasiado ampla.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A pesquisar no Idealista...
              </>
            ) : (
              <>
                <Home className="h-4 w-4 mr-2" />
                Procurar imóveis para esta lead
              </>
            )}
          </Button>

          {properties.length > 0 && (
            <Button variant="outline" onClick={handleSaveLinksAsNote} disabled={savingNote}>
              {savingNote ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <StickyNote className="h-4 w-4 mr-2" />
                  Guardar links como nota
                </>
              )}
            </Button>
          )}
        </div>

        {properties.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Resultados encontrados: <strong>{properties.length}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {properties.map((property) => (
                <div
                  key={property.propertyCode}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="h-40 w-full overflow-hidden rounded-md bg-muted md:w-56 md:flex-shrink-0">
                      {property.thumbnail ? (
                        <img
                          src={property.thumbnail}
                          alt={property.suggestedTexts?.title || "Imóvel"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Home className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {property.suggestedTexts?.title || property.propertyType}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {property.suggestedTexts?.subtitle || property.address}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {property.operation === "sale" ? "Venda" : "Arrendamento"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {property.municipality}, {property.district}
                        </div>
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4" />
                          {property.rooms || 0} quartos
                        </div>
                        <div className="flex items-center gap-1">
                          <Maximize className="h-4 w-4" />
                          {property.size || 0}m²
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-1 text-lg font-semibold text-purple-700">
                          <Euro className="h-5 w-5" />
                          {property.price.toLocaleString("pt-PT")} €
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(property.url, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver anúncio
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}