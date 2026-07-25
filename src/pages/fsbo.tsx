import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Home, Loader2, Sparkles, Users, Phone, Trash2, AlertTriangle, ExternalLink, Search,
  Clock, TrendingDown,
} from "lucide-react";
import {
  extractFsboListing, matchFsboBuyers, listFsboProspects, saveFsboProspect,
  updateFsboProspect, deleteFsboProspect, searchFsboListings, registerFsboCall,
  type FsboProspect, type FsboBuyerMatch, type FsboStatus, type FsboSearchResult,
} from "@/services/fsboService";

const STATUS_LABELS: Record<FsboStatus, string> = {
  novo: "Por contactar",
  contactado: "Contactado",
  sem_interesse: "Sem interesse",
  angariado: "Angariado",
  descartado: "Descartado",
};

const STATUS_STYLES: Record<FsboStatus, string> = {
  novo: "bg-blue-100 text-blue-800",
  contactado: "bg-amber-100 text-amber-800",
  sem_interesse: "bg-gray-100 text-gray-700",
  angariado: "bg-green-100 text-green-800",
  descartado: "bg-gray-100 text-gray-500",
};

export default function FsboPage() {
  const { toast } = useToast();
  const [prospects, setProspects] = useState<FsboProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FsboStatus | "todos">("todos");

  // Novo registo
  const [addOpen, setAddOpen] = useState(false);
  const [listingText, setListingText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState<Partial<FsboProspect> | null>(null);
  const [agencyWarning, setAgencyWarning] = useState<string | null>(null);

  // Compradores
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [matches, setMatches] = useState<FsboBuyerMatch[]>([]);
  const [matchTarget, setMatchTarget] = useState<FsboProspect | null>(null);
  const [matching, setMatching] = useState(false);

  // Busca no Idealista
  const [tab, setTab] = useState<"lista" | "procurar">("lista");
  const [searchZone, setSearchZone] = useState("");
  const [searchMin, setSearchMin] = useState("");
  const [searchMax, setSearchMax] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FsboSearchResult[] | null>(null);
  const [searchInfo, setSearchInfo] = useState<{ totalFound: number; privateCount: number } | null>(null);

  const handleSearch = async () => {
    if (!searchZone.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const data = await searchFsboListings({
        center: searchZone.trim(),
        minPrice: searchMin ? Number(searchMin) : undefined,
        maxPrice: searchMax ? Number(searchMax) : undefined,
      });
      setSearchResults(data.results);
      setSearchInfo({ totalFound: data.totalFound, privateCount: data.privateCount });
    } catch (error) {
      toast({
        title: "Erro na pesquisa",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  /**
   * O consultor tocou no número a partir da pesquisa. A chamada arranca de
   * imediato (não bloqueamos o link) e o registo é feito em paralelo: o imóvel
   * fica na lista como "Contactado", com a data e uma linha no histórico.
   *
   * Se afinal não chegou a falar, muda o estado no seletor — é um clique.
   */
  const handleCallFromSearch = async (result: FsboSearchResult) => {
    try {
      await registerFsboCall({
        prospectId: result.savedProspectId,
        prospect: {
          source: "idealista",
          source_url: result.url,
          title: result.title,
          description: result.description,
          property_type: result.propertyType,
          typology: result.typology,
          price: result.price,
          area: result.size,
          bedrooms: result.rooms,
          bathrooms: result.bathrooms,
          city: result.municipality,
          district: result.district,
          matched_buyers: result.buyerMatchCount,
          owner_name: result.contactName,
          owner_phone: result.contactPhone,
        },
      });

      setSearchResults((prev) =>
        prev
          ? prev.map((x) =>
              x.propertyCode === result.propertyCode ? { ...x, alreadySaved: true } : x
            )
          : prev
      );
      toast({
        title: "Chamada registada",
        description: `${result.title} passou a "Contactado" na tua lista.`,
      });
      await load();
    } catch (error) {
      // A chamada é o que importa — o registo é secundário.
      console.error("[fsbo] Falha ao registar a chamada:", error);
    }
  };

  /** Chamada a partir da lista guardada. */
  const handleCallProspect = async (prospect: FsboProspect) => {
    try {
      await registerFsboCall({ prospectId: prospect.id });
      toast({ title: "Chamada registada" });
      await load();
    } catch (error) {
      console.error("[fsbo] Falha ao registar a chamada:", error);
    }
  };

  const saveFromSearch = async (result: FsboSearchResult) => {
    try {
      await saveFsboProspect({
        source: "idealista",
        source_url: result.url,
        title: result.title,
        description: result.description,
        property_type: result.propertyType,
        typology: result.typology,
        price: result.price,
        area: result.size,
        bedrooms: result.rooms,
        bathrooms: result.bathrooms,
        city: result.municipality,
        district: result.district,
        matched_buyers: result.buyerMatchCount,
        owner_name: result.contactName,
        owner_phone: result.contactPhone,
      });
      setSearchResults((prev) =>
        prev ? prev.map((r) => (r.propertyCode === result.propertyCode ? { ...r, alreadySaved: true } : r)) : prev
      );
      toast({ title: "Guardado", description: "Adicionado à tua lista de particulares." });
      await load();
    } catch (error) {
      toast({
        title: "Erro ao guardar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProspects(await listFsboProspects(filter));
    } catch (error) {
      toast({
        title: "Erro ao carregar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleExtract = async () => {
    if (!listingText.trim()) return;
    setExtracting(true);
    setAgencyWarning(null);
    try {
      const data = await extractFsboListing({
        text: listingText,
        sourceUrl: sourceUrl.trim() || undefined,
      });
      setDraft(data.prospect);
      if (!data.isPrivateSeller) {
        setAgencyWarning(
          data.agencySignals || "Este anúncio parece ser de uma mediadora, não de um particular."
        );
      }
    } catch (error) {
      toast({
        title: "Não consegui organizar",
        description: error instanceof Error ? error.message : "Tenta colar mais texto.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      const saved = await saveFsboProspect({ ...draft, source_url: sourceUrl.trim() || null });
      toast({ title: "Guardado", description: "Imóvel adicionado à tua lista." });
      setAddOpen(false);
      setDraft(null);
      setListingText("");
      setSourceUrl("");
      await load();
      // Cruza logo, que é o que interessa saber antes de ligar.
      void openMatches(saved);
    } catch (error) {
      toast({
        title: "Erro ao guardar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const openMatches = async (prospect: FsboProspect) => {
    setMatchTarget(prospect);
    setMatchesOpen(true);
    setMatching(true);
    setMatches([]);
    try {
      const data = await matchFsboBuyers({ prospectId: prospect.id });
      setMatches(data.matches);
      await load();
    } catch (error) {
      toast({
        title: "Erro ao cruzar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setMatching(false);
    }
  };

  const changeStatus = async (prospect: FsboProspect, status: FsboStatus) => {
    try {
      await updateFsboProspect(prospect.id, {
        status,
        ...(status === "contactado" ? { contacted_at: new Date().toISOString() } : {}),
      });
      await load();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const remove = async (prospect: FsboProspect) => {
    if (!window.confirm(`Remover "${prospect.title || "este imóvel"}" da lista?`)) return;
    try {
      await deleteFsboProspect(prospect.id);
      await load();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <ProtectedRoute>
      <SEO title="Particulares" description="Imóveis de particulares para angariação." />
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Home className="h-6 w-6 text-blue-600" />
                Particulares
              </h1>
              <p className="text-sm text-muted-foreground">
                Imóveis de particulares que encontraste, organizados e cruzados com a tua carteira
                de compradores. O contacto é sempre feito por ti.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-lg border p-1">
                <Button
                  variant={tab === "procurar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTab("procurar")}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Procurar
                </Button>
                <Button
                  variant={tab === "lista" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTab("lista")}
                >
                  A minha lista
                </Button>
              </div>

              {tab === "lista" && (
                <Select value={filter} onValueChange={(v) => setFilter(v as FsboStatus | "todos")}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {(Object.keys(STATUS_LABELS) as FsboStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Colar anúncio
              </Button>
            </div>
          </div>

          {tab === "procurar" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Procurar particulares no Idealista</CardTitle>
                <CardDescription>
                  Mostra os anúncios sem mediadora identificada e diz-te quantos dos teus
                  compradores encaixam em cada um. Para contactar, abres o anúncio — o contacto
                  do proprietário está lá, não no Idealista via API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input
                    className="sm:col-span-2"
                    placeholder="Zona (ex.: Matosinhos)"
                    value={searchZone}
                    onChange={(e) => setSearchZone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Input
                    type="number"
                    placeholder="Preço mín."
                    value={searchMin}
                    onChange={(e) => setSearchMin(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Preço máx."
                    value={searchMax}
                    onChange={(e) => setSearchMax(e.target.value)}
                  />
                </div>

                <Button onClick={handleSearch} disabled={searching || !searchZone.trim()}>
                  {searching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Procurar
                </Button>

                {searchInfo && (
                  <p className="text-sm text-muted-foreground">
                    {searchInfo.privateCount} de {searchInfo.totalFound} anúncios parecem ser de
                    particulares.
                  </p>
                )}

                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((r) => (
                      <div key={r.propertyCode} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row">
                        {r.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnail}
                            alt=""
                            className="h-32 w-full shrink-0 rounded object-cover sm:h-20 sm:w-28"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            {r.buyerMatchCount > 0 && (
                              <Badge variant="outline" className="gap-1 bg-purple-100 text-purple-800">
                                <Users className="h-3 w-3" />
                                {r.buyerMatchCount} comprador{r.buyerMatchCount === 1 ? "" : "es"}
                              </Badge>
                            )}
                            {r.daysTracked !== null && r.daysTracked >= 1 && (
                              <Badge
                                variant="outline"
                                className={
                                  r.daysTracked >= 60
                                    ? "bg-red-100 text-red-800"
                                    : r.daysTracked >= 21
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                                }
                                title="Tempo desde que este anúncio apareceu nas tuas pesquisas. Pode já existir há mais tempo."
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                há {r.daysTracked} dia{r.daysTracked === 1 ? "" : "s"}
                              </Badge>
                            )}
                            {r.priceDrop && (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-800"
                                title={`Baixou de ${r.priceDrop.from.toLocaleString("pt-PT")} € para ${r.priceDrop.to.toLocaleString("pt-PT")} €`}
                              >
                                <TrendingDown className="mr-1 h-3 w-3" />
                                Baixou o preço
                              </Badge>
                            )}
                            {r.alreadySaved && <Badge variant="secondary">Já na lista</Badge>}
                          </div>
                          <p className="truncate font-medium">{r.title}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[
                              r.typology,
                              r.municipality,
                              r.size ? `${r.size} m²` : null,
                              r.price ? `${Number(r.price).toLocaleString("pt-PT")} €` : null,
                            ].filter(Boolean).join(" · ")}
                          </p>
                          {(r.contactName || r.contactPhone) && (
                            <p className="mt-1 flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {r.contactPhone ? (
                                <a
                                  href={`tel:${r.contactPhone}`}
                                  className="text-blue-600 hover:underline"
                                  // Sem preventDefault: a chamada arranca na
                                  // mesma; o registo corre em paralelo.
                                  onClick={() => handleCallFromSearch(r)}
                                >
                                  {r.contactPhone}
                                </a>
                              ) : null}
                              {r.contactName && (
                                <span className="text-muted-foreground">· {r.contactName}</span>
                              )}
                            </p>
                          )}
                          {r.buyerMatches.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {r.buyerMatches.map((m) => `${m.name} (${m.score}%)`).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                          <Button size="sm" variant="outline" asChild className="flex-1 sm:flex-none">
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Abrir
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveFromSearch(r)}
                            disabled={r.alreadySaved}
                            className="flex-1 sm:flex-none"
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults && searchResults.length === 0 && (
                  <p className="py-6 text-center text-muted-foreground">
                    Não encontrei anúncios de particulares nesta zona com estes critérios.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "lista" && (loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              A carregar…
            </div>
          ) : prospects.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <p className="mb-2">Ainda não tens imóveis de particulares na lista.</p>
                <p className="text-sm">
                  Quando encontrares um anúncio de particular, cola-o aqui: eu organizo os dados e
                  digo-te quantos dos teus compradores encaixam.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {prospects.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_STYLES[p.status]} variant="outline">
                          {STATUS_LABELS[p.status]}
                        </Badge>
                        {p.matched_buyers > 0 && (
                          <Badge variant="outline" className="gap-1 bg-purple-100 text-purple-800">
                            <Users className="h-3 w-3" />
                            {p.matched_buyers} comprador{p.matched_buyers === 1 ? "" : "es"}
                          </Badge>
                        )}
                        {p.source_url && (
                          <a
                            href={p.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Anúncio
                          </a>
                        )}
                      </div>

                      <p className="font-medium">{p.title || "Sem título"}</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          p.typology,
                          p.city,
                          p.area ? `${p.area} m²` : null,
                          p.price ? `${Number(p.price).toLocaleString("pt-PT")} €` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>

                      {(p.owner_name || p.owner_phone) && (
                        <p className="mt-1 flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {p.owner_phone && (
                            <a
                              href={`tel:${p.owner_phone}`}
                              className="text-blue-600 hover:underline"
                              onClick={() => handleCallProspect(p)}
                            >
                              {p.owner_phone}
                            </a>
                          )}
                          {p.owner_name && (
                            <span className="text-muted-foreground">
                              {p.owner_phone ? "· " : ""}{p.owner_name}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openMatches(p)}>
                        <Users className="mr-1 h-4 w-4" />
                        Ver compradores
                      </Button>
                      <Select
                        value={p.status}
                        onValueChange={(v) => changeStatus(p, v as FsboStatus)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABELS) as FsboStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>

        {/* Adicionar anúncio */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar anúncio de particular</DialogTitle>
              <DialogDescription>
                Cola aqui o texto do anúncio que encontraste. Eu organizo os dados e cruzo com os
                teus compradores — o contacto com o proprietário é sempre feito por ti.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                placeholder="Link do anúncio (opcional)"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              <Textarea
                placeholder="Cola aqui o texto do anúncio…"
                rows={8}
                value={listingText}
                onChange={(e) => setListingText(e.target.value)}
              />

              <Button onClick={handleExtract} disabled={extracting || !listingText.trim()}>
                {extracting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Organizar dados
              </Button>

              {agencyWarning && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{agencyWarning}</span>
                </div>
              )}

              {draft && (
                <div className="divide-y rounded-md border">
                  {Object.entries(draft)
                    .filter(([, v]) => v !== null && v !== undefined && v !== "")
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="text-right font-medium">{String(value)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!draft}>Guardar na lista</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Compradores que encaixam */}
        <Dialog open={matchesOpen} onOpenChange={setMatchesOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compradores para este imóvel</DialogTitle>
              <DialogDescription>
                {matchTarget?.title || "Imóvel"} — os teus compradores com maior afinidade.
              </DialogDescription>
            </DialogHeader>

            {matching ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                A cruzar com a carteira…
              </div>
            ) : matches.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum comprador da tua carteira encaixa neste imóvel.
              </p>
            ) : (
              <div className="space-y-2">
                {matches.map((m) => (
                  <div key={m.leadId} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium">{m.name}</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {m.score}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[m.phone, m.email].filter(Boolean).join(" · ")}
                    </p>
                    {m.reasons.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.reasons.join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
