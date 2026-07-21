import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, Sparkles, Loader2, Download, Send, TrendingUp, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import {
  addCoverPage, addAboutPage, addClosingPage, addPageHeader, addPageNumbers,
  addSectionTitle, addKeyValueTable, addValueEstimate, addComparableCard, addBodyText,
  addLocationMap, addPointsOfInterest,
  buildConsultantIdentity, type ConsultantIdentity,
} from "@/lib/pdfDocument";

interface Comparable {
  source: string;
  status: "sold" | "active";
  address: string;
  area: number | null;
  price: number | null;
  pricePerSqm: number | null;
}

interface ValuationResult {
  comparables: Comparable[];
  soldAvgPricePerSqm: number | null;
  activeAvgPricePerSqm: number | null;
  suggestedMin: number | null;
  suggestedMax: number | null;
  narrative: string;
}

interface LinkedLead {
  id: string;
  name: string;
  email: string | null;
}

function formatCurrency(value: number | null): string {
  if (!value) return "—";
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

const PROPERTY_TYPE_PT: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  land: "Terreno",
  commercial: "Comercial",
  store: "Loja",
  office: "Escritório",
  warehouse: "Armazém",
};

export default function ValuationPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    address: "",
    city: "",
    propertyType: "apartment",
    area: "",
    bedrooms: "",
    bathrooms: "",
    condition: "",
    // Características com impacto no valor. Dois T2 iguais em área podem
    // diferir 15-20% consoante tenham elevador, garagem ou varanda.
    floor: "",
    energyRating: "",
    yearBuilt: "",
    hasElevator: false,
    hasGarage: false,
    hasBalcony: false,
    hasTerrace: false,
    hasStorage: false,
    hasAirConditioning: false,
    hasPool: false,
    hasSeaView: false,
  });

  // Perfil do consultor: alimenta a capa, o cabeçalho e a folha de fecho do PDF.
  const [consultant, setConsultant] = useState<ConsultantIdentity | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone, company_name, ami_license, document_cover_title, document_about_me, document_closing_text")
        .eq("id", user.id)
        .maybeSingle();
      setConsultant(buildConsultantIdentity(profile, user.email));
    })();
  }, []);

  const [linkedLead, setLinkedLead] = useState<LinkedLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const leadId = router.query.leadId;
    if (typeof leadId !== "string") return;
    supabase
      .from("leads")
      .select("id, name, email, location_preference")
      .eq("id", leadId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLinkedLead({ id: data.id, name: data.name, email: data.email });
          if (data.location_preference) {
            setForm((prev) => ({ ...prev, city: data.location_preference as string }));
          }
        }
      });
  }, [router.query.leadId]);

  const handleGenerate = async () => {
    if (!form.address || !form.propertyType) {
      toast({ title: "Preencha pelo menos a morada e o tipo de imóvel", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gpt/valuation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          address: form.address,
          city: form.city || undefined,
          propertyType: form.propertyType,
          area: form.area ? Number(form.area) : undefined,
          bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
          condition: form.condition || undefined,
          factors: {
            floor: form.floor ? Number(form.floor) : null,
            energyRating: form.energyRating || null,
            yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
            hasElevator: form.hasElevator,
            hasGarage: form.hasGarage,
            hasBalcony: form.hasBalcony,
            hasTerrace: form.hasTerrace,
            hasStorage: form.hasStorage,
            hasAirConditioning: form.hasAirConditioning,
            hasPool: form.hasPool,
            hasSeaView: form.hasSeaView,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar avaliação");
      setResult(data);
    } catch (error: any) {
      toast({ title: "Erro ao gerar avaliação", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const buildPdf = (): jsPDF | null => {
    if (!result) return null;
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();

    const identity: ConsultantIdentity =
      consultant || { name: "Consultor Imobiliário" };

    // Capa + apresentação do consultor (esta só se ele a tiver escrito).
    addCoverPage(doc, {
      documentTitle: "Estudo Comparativo de Mercado",
      subtitle: form.address,
      consultant: identity,
    });
    addAboutPage(doc, identity);

    // --- Informações da propriedade ---
    doc.addPage();
    addPageHeader(doc, identity, "Informações da Propriedade");
    let y = 46;

    y = addSectionTitle(doc, "Detalhes da propriedade", y);
    y = addKeyValueTable(doc, [
      ["Endereço", form.address],
      ["Cidade", form.city],
      ["Tipo de propriedade", PROPERTY_TYPE_PT[form.propertyType] || form.propertyType],
      ["Quartos", form.bedrooms ? String(form.bedrooms) : null],
      ["Casas de banho", form.bathrooms ? String(form.bathrooms) : null],
      ["Área de construção", form.area ? `${form.area} m2` : null],
      ["Piso", form.floor != null && form.floor !== "" ? String(form.floor) : null],
      ["Ano de construção", form.yearBuilt ? String(form.yearBuilt) : null],
      ["Classe energética", form.energyRating],
      ["Estado de conservação", form.condition],
    ], y);

    // Características: só as que o imóvel tem. Uma lista de "não tem" seria
    // ruído num documento que vai à frente do proprietário.
    const characteristics = [
      form.hasElevator ? "Elevador" : null,
      form.hasGarage ? "Garagem" : null,
      form.hasBalcony ? "Varanda" : null,
      form.hasTerrace ? "Terraço" : null,
      form.hasPool ? "Piscina" : null,
      form.hasStorage ? "Arrecadação" : null,
      form.hasAirConditioning ? "Ar condicionado" : null,
      form.hasSeaView ? "Vista de mar" : null,
    ].filter(Boolean) as string[];

    if (characteristics.length > 0) {
      y = addSectionTitle(doc, "Características", y + 4);
      y = addBodyText(doc, characteristics.join("   ·   "), y);
    }

    // --- Valor estimado ---
    doc.addPage();
    addPageHeader(doc, identity, "Valor Estimado");
    y = 46;

    y = addSectionTitle(doc, "Valor estimado", y);
    y = addBodyText(doc, form.address, y);
    y = addValueEstimate(
      doc,
      {
        min: result.suggestedMin,
        max: result.suggestedMax,
        area: form.area ? Number(form.area) : null,
      },
      y
    );

    // --- Envolvente (mapa + pontos de interesse) ---
    // Só existe se as fontes externas responderam; caso contrário o documento
    // segue sem esta página, sem qualquer aviso ao cliente.
    const insights = (result as any).locationInsights;
    if (insights && (insights.mapDataUri || (insights.pois || []).length > 0)) {
      doc.addPage();
      addPageHeader(doc, identity, "Envolvente");
      y = 46;
      y = addSectionTitle(doc, "Localização e envolvente", y);
      y = addLocationMap(doc, insights.mapDataUri || null, y);
      y = addPointsOfInterest(doc, insights.pois || [], y);
    }

    // --- Comparáveis ---
    doc.addPage();
    addPageHeader(doc, identity, "Comparáveis");
    y = 46;
    y = addSectionTitle(doc, "Imóveis comparáveis", y);

    result.comparables.slice(0, 12).forEach((c: any) => {
      // Cada cartão tem altura variável — verifica-se o espaço antes de o
      // desenhar, senão parte-se a meio na mudança de página.
      if (y > pageHeight - 60) {
        doc.addPage();
        addPageHeader(doc, identity, "Comparáveis");
        y = 46;
      }
      y = addComparableCard(doc, {
        status: c.status,
        address: c.address,
        price: c.price,
        area: c.area,
        pricePerSqm: c.pricePerSqm,
        propertyType: c.propertyType,
        energyRating: c.energyRating,
        yearBuilt: c.yearBuilt,
        daysOnMarket: c.daysOnMarket,
        distanceKm: c.distanceKm,
        features: c.features,
      }, y);
    });

    // --- Análise ---
    doc.addPage();
    addPageHeader(doc, identity, "Análise");
    y = 46;
    y = addSectionTitle(doc, "Análise de mercado", y);

    const plainNarrative = result.narrative.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    y = addBodyText(doc, plainNarrative, y);

    // Folha de fecho (só se o consultor a tiver escrito) e numeração.
    addClosingPage(doc, identity);
    addPageNumbers(doc);

    return doc;
  };

  const handleExportPdf = () => {
    const doc = buildPdf();
    if (!doc) return;
    doc.save(`Avaliacao_${form.address.replace(/\s+/g, "_")}.pdf`);
  };

  const handleSendByEmail = async () => {
    if (!linkedLead?.email) {
      toast({ title: "Sem lead ligada com email", variant: "destructive" });
      return;
    }
    const doc = buildPdf();
    if (!doc) return;

    setSendingEmail(true);
    try {
      const base64Content = doc.output("datauristring").split(",").pop() || "";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/smtp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          to: linkedLead.email,
          subject: `Avaliação do seu imóvel — ${form.address}`,
          html: `<p>Olá ${linkedLead.name},</p><p>Em anexo enviamos a avaliação comparativa de mercado que preparámos para o seu imóvel.</p>`,
          attachments: [{ filename: `Avaliacao_${form.address.replace(/\s+/g, "_")}.pdf`, content: base64Content, encoding: "base64" }],
        }),
      });
      const responseData = await res.json();
      if (!responseData.success) throw new Error(responseData.error || "Erro ao enviar");
      toast({ title: "✅ Avaliação enviada", description: `Enviada para ${linkedLead.email}` });
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="Avaliação de Imóvel">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-100">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Home className="h-6 w-6 text-blue-600" />
              Avaliação Comparativa de Mercado
            </h1>
            <p className="text-slate-600 mt-1">
              Prepare uma avaliação profissional para apresentar numa angariação — com imóveis comparáveis reais e um preço sugerido.
            </p>
            {linkedLead && (
              <Badge variant="outline" className="mt-3 bg-white">Ligada a {linkedLead.name}</Badge>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Dados do Imóvel</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Morada *</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ex: Rua das Flores, 123, Lisboa" />
              </div>
              <div className="space-y-2">
                <Label>Cidade / Zona</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex: Lisboa" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Imóvel *</Label>
                <Select value={form.propertyType} onValueChange={(v) => setForm({ ...form, propertyType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartamento</SelectItem>
                    <SelectItem value="house">Moradia</SelectItem>
                    <SelectItem value="land">Terreno</SelectItem>
                    <SelectItem value="commercial">Comercial</SelectItem>
                    <SelectItem value="office">Escritório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Área (m²)</Label>
                <Input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Ex: 90" />
              </div>
              <div className="space-y-2">
                <Label>Tipologia (quartos)</Label>
                <Input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="Ex: 2" />
              </div>
              <div className="space-y-2">
                <Label>Casas de Banho</Label>
                <Input type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} placeholder="Ex: 1" />
              </div>
              <div className="space-y-2">
                <Label>Estado de Conservação</Label>
                <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="Ex: Renovado em 2022" />
              </div>
              <div className="space-y-2">
                <Label>Andar</Label>
                <Input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="Ex: 3 (0 = r/c)" />
              </div>
              <div className="space-y-2">
                <Label>Classe Energética</Label>
                <Input value={form.energyRating} onChange={(e) => setForm({ ...form, energyRating: e.target.value })} placeholder="Ex: B-" />
              </div>
              <div className="space-y-2">
                <Label>Ano de Construção</Label>
                <Input type="number" value={form.yearBuilt} onChange={(e) => setForm({ ...form, yearBuilt: e.target.value })} placeholder="Ex: 2008" />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>Características</Label>
                <p className="text-xs text-muted-foreground">
                  Marca o que o imóvel tem. Estas características são consideradas na avaliação —
                  a ausência de elevador num andar alto, por exemplo, pesa no valor.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["hasElevator", "Elevador"],
                    ["hasGarage", "Garagem"],
                    ["hasBalcony", "Varanda"],
                    ["hasTerrace", "Terraço"],
                    ["hasStorage", "Arrecadação"],
                    ["hasAirConditioning", "Ar condicionado"],
                    ["hasPool", "Piscina"],
                    ["hasSeaView", "Vista mar"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={form[key] as boolean}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <Button onClick={handleGenerate} disabled={loading} className="w-full md:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Gerar Avaliação
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <>
              {result.suggestedMin && result.suggestedMax ? (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <TrendingUp className="h-8 w-8 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm text-emerald-700 font-medium">Valor Recomendado</p>
                      <p className="text-2xl font-bold text-emerald-900">
                        {formatCurrency(result.suggestedMin)} — {formatCurrency(result.suggestedMax)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-6 text-sm text-amber-800">
                    Não há comparáveis suficientes na zona para sugerir um valor com confiança — reveja a análise abaixo manualmente.
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleExportPdf}>
                  <Download className="h-4 w-4 mr-2" /> Exportar PDF
                </Button>
                {linkedLead?.email && (
                  <Button variant="outline" onClick={handleSendByEmail} disabled={sendingEmail}>
                    {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar por Email
                  </Button>
                )}
              </div>

              {result.narrative && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Relatório</CardTitle></CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: result.narrative }} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Imóveis Comparáveis ({result.comparables.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {result.comparables.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum comparável encontrado na zona.</p>
                  ) : (
                    result.comparables.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={c.status === "sold" ? "bg-emerald-600" : "bg-blue-500"}>
                              {c.status === "sold" ? "Vendido" : "Ativo"}
                            </Badge>
                            <span className="text-xs text-gray-400">{c.source}</span>
                          </div>
                          <p className="text-sm mt-1 flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-gray-400" /> {c.address}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{formatCurrency(c.price)}</p>
                          <p className="text-xs text-gray-500">{c.area ? `${c.area} m²` : ""}{c.pricePerSqm ? ` · ${Math.round(c.pricePerSqm)}€/m²` : ""}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
