import { useState } from "react";
import { Bot, Building2, Home, Loader2, MapPin, Bed, Maximize, Euro, StickyNote, BadgeInfo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { LeadWithContacts } from "@/services/leadsService";
import type { RemaxDevelopment, RemaxListing } from "@/services/remaxService";

interface LeadRemaxPanelProps {
  lead: LeadWithContacts;
}

interface RemaxLeadResponse {
  developments: RemaxDevelopment[];
  listings: RemaxListing[];
  fallbackWithoutCounty: boolean;
}

function formatCurrency(value: number | null): string {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRemaxListingsNote(listings: RemaxListing[]): string {
  const lines = listings.slice(0, 10).map((listing, index) => {
    const location = [listing.parish, listing.county, listing.region].filter(Boolean).join(", ");
    const details = [
      listing.listingTitle ? `ref. ${listing.listingTitle}` : null,
      listing.price ? formatCurrency(listing.price) : null,
      typeof listing.bedrooms === "number" ? `${listing.bedrooms} quartos` : null,
      typeof listing.totalArea === "number" ? `${listing.totalArea}m²` : null,
      location || null,
      listing.officeName ? `agência: ${listing.officeName}` : null,
    ].filter(Boolean);

    return `${index + 1}. ${listing.developmentName}${details.length > 0 ? ` — ${details.join(" · ")}` : ""}`;
  });

  return `🏗️ Referências REMAX sugeridas automaticamente:\n\n${lines.join("\n")}`;
}

export function LeadRemaxPanel({ lead }: LeadRemaxPanelProps) {
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [developments, setDevelopments] = useState<RemaxDevelopment[]>([]);
  const [listings, setListings] = useState<RemaxListing[]>([]);
  const [fallbackWithoutCounty, setFallbackWithoutCounty] = useState(false);
  const { toast } = useToast();

  const canSearch = lead.lead_type === "buyer" || lead.lead_type === "both";

  const summaryItems = [
    lead.location_preference ? { label: "Zona", value: lead.location_preference } : null,
    lead.property_type ? { label: "Tipo", value: lead.property_type } : null,
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

      const response = await fetch("/api/remax/search-for-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const data = (await response.json()) as Partial<RemaxLeadResponse> & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Erro ao pesquisar empreendimentos REMAX");
      }

      const nextDevelopments = Array.isArray(data.developments) ? data.developments : [];
      const nextListings = Array.isArray(data.listings) ? data.listings : [];

      setDevelopments(nextDevelopments);
      setListings(nextListings);
      setFallbackWithoutCounty(Boolean(data.fallbackWithoutCounty));

      toast({
        title: nextListings.length > 0 ? "Pesquisa concluída" : "Sem resultados",
        description:
          nextListings.length > 0
            ? `Foram encontradas ${nextListings.length} unidades REMAX adaptadas a esta lead.`
            : "Não foram encontrados empreendimentos ou unidades com este perfil na REMAX.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível pesquisar empreendimentos REMAX.";
      toast({
        title: "Erro na pesquisa",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsNote = async () => {
    if (listings.length === 0) {
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

      const note = formatRemaxListingsNote(listings);

      const { error } = await supabase.from("lead_notes" as never).insert({
        lead_id: lead.id,
        note,
        user_id: user.id,
        created_at: new Date().toISOString(),
      } as never);

      if (error) {
        throw error;
      }

      toast({
        title: "Referências guardadas",
        description: "As referências REMAX encontradas foram adicionadas como nota privada.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível guardar as referências.";
      toast({
        title: "Erro ao guardar",
        description: message,
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
    <Card className="border-red-200 bg-red-50/40">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5 text-red-700" />
          Painel IA · Pesquisa assistida na REMAX
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Usa os dados desta lead para pesquisar empreendimentos e unidades REMAX sem sair da ficha.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {summaryItems.length > 0 ? (
            summaryItems.map((item) => (
              <Badge key={item.label} variant="outline" className="bg-white">
                <span className="mr-1 font-medium">{item.label}:</span>
                {item.value}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta lead ainda tem poucos critérios. A pesquisa na REMAX pode ficar demasiado ampla.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A pesquisar na REMAX...
              </>
            ) : (
              <>
                <Building2 className="mr-2 h-4 w-4" />
                Procurar empreendimentos para esta lead
              </>
            )}
          </Button>

          {listings.length > 0 && (
            <Button variant="outline" onClick={handleSaveAsNote} disabled={savingNote}>
              {savingNote ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <StickyNote className="mr-2 h-4 w-4" />
                  Guardar referências como nota
                </>
              )}
            </Button>
          )}
        </div>

        {fallbackWithoutCounty && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Não houve resultados com o concelho inicial da lead. A pesquisa foi alargada automaticamente sem esse filtro.
          </div>
        )}

        {developments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Empreendimentos: <strong>{developments.length}</strong> · Unidades ativas: <strong>{listings.length}</strong>
              </p>
              <Badge variant="outline" className="bg-white text-red-700 border-red-200">
                REMAX
              </Badge>
            </div>

            <div className="space-y-3">
              {developments.map((development) => {
                const activeUnits = development.units.filter((unit) => unit.isActive && !unit.isSold);

                return (
                  <div key={development.id} className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-foreground">{development.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {[development.localZone, development.parish, development.county, development.region]
                            .filter(Boolean)
                            .join(", ") || "Localização não indicada"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Preço desde</p>
                        <p className="font-semibold text-red-700">{formatCurrency(development.minimumPrice)}</p>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {development.officeName && (
                        <Badge variant="outline" className="bg-slate-50">
                          Agência: {development.officeName}
                        </Badge>
                      )}
                      {development.agentName && (
                        <Badge variant="outline" className="bg-slate-50">
                          Consultor: {development.agentName}
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-slate-50">
                        {development.listingsCount} unidades
                      </Badge>
                    </div>

                    {activeUnits.length > 0 ? (
                      <div className="space-y-2">
                        {activeUnits.slice(0, 4).map((unit) => (
                          <div key={unit.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium text-sm">
                                  {unit.listingType || "Unidade"}{unit.listingTitle ? ` · Ref. ${unit.listingTitle}` : ""}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                  {unit.county && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-4 w-4" />
                                      {[unit.parish, unit.county].filter(Boolean).join(", ")}
                                    </span>
                                  )}
                                  {typeof unit.bedrooms === "number" && (
                                    <span className="flex items-center gap-1">
                                      <Bed className="h-4 w-4" />
                                      {unit.bedrooms} quartos
                                    </span>
                                  )}
                                  {typeof unit.totalArea === "number" && (
                                    <span className="flex items-center gap-1">
                                      <Maximize className="h-4 w-4" />
                                      {unit.totalArea}m²
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-base font-semibold text-red-700">
                                  <Euro className="h-4 w-4" />
                                  {formatCurrency(unit.price)}
                                </div>
                                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                                  <BadgeInfo className="mr-1 h-3 w-3" />
                                  Sem link público na API
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                        O empreendimento foi encontrado, mas esta resposta não trouxe unidades ativas utilizáveis.
                      </div>
                    )}

                    {!development.picturePath && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Home className="h-4 w-4" />
                        A API devolveu referências estruturadas, mas sem URL pública de anúncio.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}