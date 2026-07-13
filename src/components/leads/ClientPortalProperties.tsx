import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserCombobox } from "@/components/ui/user-combobox";
import { Loader2, Plus, X, Target, Home, Link as LinkIcon, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { findMatchesForLead } from "@/services/matchingService";
import { getProperties } from "@/services/propertiesService";
import {
  getPortalMatches, getPortalExternal, addPortalProperty, addPortalExternal,
  removePortalMatch, removePortalExternal, type PortalMatch, type PortalExternalListing,
} from "@/services/portalMatchesService";

interface Props {
  leadId: string;
}

function formatPrice(v?: number | null) {
  if (!v) return "";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

// Gere manualmente os imóveis mostrados na secção "Imóveis para si" do Portal
// do Cliente: imóveis do CRM (por sugestão ou pesquisa) e links externos.
// Cada adição alerta o cliente por email.
export function ClientPortalProperties({ leadId }: Props) {
  const { toast } = useToast();
  const [added, setAdded] = useState<PortalMatch[]>([]);
  const [externals, setExternals] = useState<PortalExternalListing[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [allProps, setAllProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  // Link externo
  const [extTitle, setExtTitle] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [extImage, setExtImage] = useState("");
  const [extPrice, setExtPrice] = useState("");
  const [addingExt, setAddingExt] = useState(false);
  const [importingExt, setImportingExt] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [portal, ext, sugg, props] = await Promise.all([
        getPortalMatches(leadId),
        getPortalExternal(leadId),
        findMatchesForLead(leadId).catch(() => []),
        getProperties().catch(() => []),
      ]);
      setAdded(portal);
      setExternals(ext);
      setSuggestions(sugg || []);
      setAllProps(props || []);
    } catch (err) {
      console.error("[ClientPortalProperties] load:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const addedIds = new Set(added.map((a) => a.property_id));

  const handleAddProperty = async (propertyId: string) => {
    setBusyId(propertyId);
    try {
      await addPortalProperty(leadId, propertyId);
      await load();
      toast({ title: "Imóvel adicionado", description: "O cliente foi notificado por email." });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleAddManual = async () => {
    if (!manualId) return;
    await handleAddProperty(manualId);
    setManualId("");
  };

  // Usa a mesma extração de link dos "Emails por Procura" para preencher
  // Título/Preço/Imagem a partir do URL. Só preenche os campos — o link só é
  // adicionado ao portal quando o consultor clicar em "Adicionar link".
  const handleImportExternal = async () => {
    const url = extUrl.trim();
    if (!url) {
      toast({ title: "Cole primeiro o link", variant: "destructive" });
      return;
    }
    setImportingExt(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/gpt/properties/extract-listing-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ sourceUrl: url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível ler o link");

      if (data.sourceTitle) setExtTitle(data.sourceTitle);
      if (data.sourceImage) setExtImage(data.sourceImage);
      if (data.sourcePrice) setExtPrice(String(data.sourcePrice));

      toast({
        title: "Link lido",
        description: "Reveja os campos preenchidos e clique em Adicionar link.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao ler o link", description: err.message, variant: "destructive" });
    } finally {
      setImportingExt(false);
    }
  };

  const handleAddExternal = async () => {
    if (!extTitle.trim() || !extUrl.trim()) {
      toast({ title: "Título e link são obrigatórios", variant: "destructive" });
      return;
    }
    setAddingExt(true);
    try {
      await addPortalExternal(leadId, {
        title: extTitle.trim(),
        url: extUrl.trim(),
        image_url: extImage.trim() || undefined,
        price: extPrice ? Number(extPrice) : null,
      });
      setExtTitle(""); setExtUrl(""); setExtImage(""); setExtPrice("");
      await load();
      toast({ title: "Link adicionado", description: "O cliente foi notificado por email." });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar link", description: err.message, variant: "destructive" });
    } finally {
      setAddingExt(false);
    }
  };

  const handleRemoveMatch = async (m: PortalMatch) => {
    setBusyId(m.property_id);
    try {
      await removePortalMatch(m.id);
      setAdded((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveExternal = async (e: PortalExternalListing) => {
    setBusyId(e.id);
    try {
      await removePortalExternal(e.id);
      setExternals((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> A carregar...</div>;
  }

  const pendingSuggestions = suggestions.filter((s) => !addedIds.has(s.property?.id));
  const manualOptions = allProps
    .filter((p) => !addedIds.has(p.id) && p.status !== "sold")
    .map((p) => ({ id: p.id, name: p.title, email: [p.city, formatPrice(p.price)].filter(Boolean).join(" · ") }));

  return (
    <div className="space-y-6">
      {/* No portal */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">No portal do cliente</h3>
        <p className="text-sm text-muted-foreground mb-3">Aparecem na secção "Imóveis para si" do portal deste cliente. Cada adição envia-lhe um email.</p>
        {added.length === 0 && externals.length === 0 ? (
          <div className="text-center py-6 text-gray-500 border rounded-lg border-dashed">
            <Home className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Ainda não há imóveis no portal deste cliente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {added.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <span className="font-medium truncate">{m.property?.title || "Imóvel"}</span>
                  <p className="text-xs text-muted-foreground">{[m.property?.city, formatPrice(m.property?.price)].filter(Boolean).join(" · ")}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" disabled={busyId === m.property_id} onClick={() => handleRemoveMatch(m)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {externals.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <span className="font-medium truncate flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-blue-600" /> {e.title}</span>
                  <p className="text-xs text-muted-foreground truncate">{[formatPrice(e.price), e.url].filter(Boolean).join(" · ")}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" disabled={busyId === e.id} onClick={() => handleRemoveExternal(e)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar imóvel do CRM */}
      <div className="space-y-2">
        <h3 className="font-semibold text-slate-900">Adicionar imóvel do CRM</h3>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <UserCombobox users={manualOptions} value={manualId} onChange={setManualId} placeholder="Procurar imóvel por título…" emptyText="Nenhum imóvel disponível" />
          </div>
          <Button onClick={handleAddManual} disabled={!manualId || busyId === manualId}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        {manualOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {allProps.length === 0
              ? "Ainda não tem imóveis no CRM. Crie imóveis em Imóveis, ou adicione um link externo abaixo."
              : "Todos os seus imóveis disponíveis já estão no portal (ou estão vendidos). Pode adicionar um link externo abaixo."}
          </p>
        )}
      </div>

      {/* Adicionar link externo */}
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-600" /> Adicionar link externo</h3>
        <p className="text-sm text-muted-foreground">Ex: um anúncio no Idealista. Cole o link e clique em Importar para preencher automaticamente o título e o preço. Aparece no portal como os restantes imóveis.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Link (URL) *</Label>
            <div className="flex gap-2">
              <Input value={extUrl} onChange={(e) => setExtUrl(e.target.value)} placeholder="https://…" />
              <Button type="button" variant="outline" onClick={handleImportExternal} disabled={importingExt || !extUrl.trim()}>
                {importingExt ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-1" /> Importar</>}
              </Button>
            </div>
          </div>
          <div><Label className="text-xs">Título *</Label><Input value={extTitle} onChange={(e) => setExtTitle(e.target.value)} placeholder="Ex: T2 no centro de Lisboa" /></div>
          <div><Label className="text-xs">Preço (€)</Label><Input type="number" value={extPrice} onChange={(e) => setExtPrice(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Imagem (URL, opcional)</Label><Input value={extImage} onChange={(e) => setExtImage(e.target.value)} placeholder="https://…/foto.jpg" /></div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAddExternal} disabled={addingExt}>
            {addingExt ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar link</>}
          </Button>
        </div>
      </div>

      {/* Sugestões automáticas (ajuda — a adição continua manual) */}
      {pendingSuggestions.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2"><Target className="h-4 w-4 text-blue-600" /> Sugestões</h3>
          <p className="text-sm text-muted-foreground mb-3">Imóveis que correspondem aos critérios desta lead — adicione os que quiser.</p>
          <div className="space-y-2">
            {pendingSuggestions.map((s) => (
              <div key={s.property.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{s.property.title}</span>
                    <Badge className="bg-blue-600 text-xs shrink-0">{s.match_score}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{[s.property.city, formatPrice(s.property.price)].filter(Boolean).join(" · ")}</p>
                </div>
                <Button variant="outline" size="sm" disabled={busyId === s.property.id} onClick={() => handleAddProperty(s.property.id)}>
                  {busyId === s.property.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
