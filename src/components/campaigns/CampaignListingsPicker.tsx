import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, Building, Plus, X, Upload, Link as LinkIcon, Loader2, CheckCircle2, Search } from "lucide-react";
import { getProperties } from "@/services/propertiesService";
import { getDevelopments, getTypologiesByDevelopment } from "@/services/developmentsService";
import { buildPropertyBlock, buildDevelopmentBlock } from "@/lib/campaignListings";
import type { Property, Development, DevelopmentTypology } from "@/types";

/** Um imóvel externo (brochura/link) já extraído para texto. */
export interface ExternalListing {
  id: string;
  title: string;
  text: string;
}

/** Referência a um imóvel selecionado (carteira ou externo). */
export interface SelectedListing {
  key: string;
  kind: "property" | "development" | "external";
  label: string;
  /** Texto factual pré-composto (usado em joinListingBlocks). */
  block: string;
}

interface Props {
  selected: SelectedListing[];
  onChange: (next: SelectedListing[]) => void;
  /** Extrair conteúdo de brochura/link — reutiliza o handler da página. */
  onExtractExternal: (payload: { documentBase64?: string; documentName?: string; sourceUrl?: string }) => Promise<ExternalListing | null>;
  isExtracting: boolean;
}

const currency = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function CampaignListingsPicker({ selected, onChange, onExtractExternal, isExtracting }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [typologiesByDev, setTypologiesByDev] = useState<Record<string, DevelopmentTypology[]>>({});
  const [origin, setOrigin] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [listingMode, setListingMode] = useState<"none" | "document" | "url">("none");
  const [listingUrl, setListingUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    Promise.all([
      getProperties().catch(() => []),
      getDevelopments().catch(() => []),
      getTypologiesByDevelopment().catch(() => ({} as Record<string, DevelopmentTypology[]>)),
    ]).then(([props, devs, typ]) => {
      // Só imóveis divulgáveis (não vendidos/arrendados)
      setProperties(props.filter((p) => p.status === "available" || p.status === "reserved"));
      setDevelopments(devs.filter((d) => d.status === "published" || d.status === "under_construction"));
      setTypologiesByDev(typ);
    });
  }, []);

  const selectedKeys = useMemo(() => new Set(selected.map((s) => s.key)), [selected]);

  const filteredProperties = useMemo(() => {
    const q = search.toLowerCase().trim();
    return properties.filter((p) => {
      if (selectedKeys.has(`property:${p.id}`)) return false;
      if (!q) return true;
      return [p.title, p.city, p.district, p.typology].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [properties, search, selectedKeys]);

  const filteredDevelopments = useMemo(() => {
    const q = search.toLowerCase().trim();
    return developments.filter((d) => {
      if (selectedKeys.has(`development:${d.id}`)) return false;
      if (!q) return true;
      return [d.name, d.city, d.district].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [developments, search, selectedKeys]);

  const addProperty = (p: Property) => {
    onChange([...selected, {
      key: `property:${p.id}`,
      kind: "property",
      label: `${p.title}${p.city ? ` · ${p.city}` : ""}`,
      block: buildPropertyBlock(p, origin),
    }]);
    setSearch("");
  };

  const addDevelopment = (d: Development) => {
    onChange([...selected, {
      key: `development:${d.id}`,
      kind: "development",
      label: `${d.name}${d.city ? ` · ${d.city}` : ""}`,
      block: buildDevelopmentBlock(d, typologiesByDev[d.id] || [], origin),
    }]);
    setSearch("");
  };

  const remove = (key: string) => onChange(selected.filter((s) => s.key !== key));

  const handleDocument = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const ext = await onExtractExternal({ documentBase64: reader.result as string, documentName: file.name });
      if (ext) {
        onChange([...selected, { key: `external:${ext.id}`, kind: "external", label: ext.title, block: ext.text }]);
        setListingMode("none");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrl = async () => {
    if (!listingUrl.trim()) return;
    const url = listingUrl.trim();
    const ext = await onExtractExternal({ sourceUrl: url });
    if (ext) {
      // Inclui o URL colado no bloco, para a IA poder pô-lo no email (o texto
      // extraído da página não contém o próprio link).
      onChange([...selected, { key: `external:${ext.id}`, kind: "external", label: ext.title, block: `Link: ${url}\n\n${ext.text}` }]);
      setListingUrl("");
      setListingMode("none");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4 bg-slate-50">
      <div>
        <Label>Imóveis a divulgar (opcional)</Label>
        <p className="text-xs text-gray-500 mt-0.5">
          Escolha um ou mais imóveis/empreendimentos da sua carteira, ou junte brochuras/links externos.
          A IA escreve o email a divulgar todos, usando os dados reais.
        </p>
      </div>

      {/* Imóveis já selecionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <Badge key={s.key} variant="secondary" className="py-1.5 gap-1.5">
              {s.kind === "development" ? <Building className="h-3.5 w-3.5" /> : s.kind === "property" ? <Building2 className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {s.label}
              <button type="button" onClick={() => remove(s.key)} className="ml-0.5 hover:text-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Seletor da carteira */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar da carteira
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar imóvel ou empreendimento..."
              className="border-0 focus-visible:ring-0 shadow-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredProperties.length === 0 && filteredDevelopments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nada encontrado.</p>
            )}
            {filteredProperties.length > 0 && (
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Imóveis</div>
            )}
            {filteredProperties.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProperty(p)}
                className="w-full text-left px-2 py-2 rounded hover:bg-slate-100 flex items-start gap-2"
              >
                <Building2 className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{p.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {[p.typology, p.city, p.price ? currency.format(p.price) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
            {filteredDevelopments.length > 0 && (
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Empreendimentos</div>
            )}
            {filteredDevelopments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => addDevelopment(d)}
                className="w-full text-left px-2 py-2 rounded hover:bg-slate-100 flex items-start gap-2"
              >
                <Building className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{d.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {[d.city, d.price_from ? `desde ${currency.format(d.price_from)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Externos: brochura / link */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant={listingMode === "document" ? "default" : "outline"} onClick={() => setListingMode(listingMode === "document" ? "none" : "document")}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Brochura (PDF/Word)
        </Button>
        <Button type="button" size="sm" variant={listingMode === "url" ? "default" : "outline"} onClick={() => setListingMode(listingMode === "url" ? "none" : "url")}>
          <LinkIcon className="h-3.5 w-3.5 mr-1.5" /> Link da publicação
        </Button>
      </div>

      {listingMode === "document" && (
        <Input type="file" accept=".pdf,.docx" disabled={isExtracting} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocument(f); }} />
      )}
      {listingMode === "url" && (
        <div className="flex gap-2">
          <Input placeholder="https://..." value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} />
          <Button type="button" variant="outline" disabled={isExtracting || !listingUrl.trim()} onClick={handleUrl}>Ler</Button>
        </div>
      )}
      {isExtracting && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> A ler o conteúdo do imóvel...</p>
      )}
      {selected.some((s) => s.kind !== "external") === false && selected.some((s) => s.kind === "external") && !isExtracting && (
        <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Conteúdo externo adicionado.</p>
      )}
    </div>
  );
}
