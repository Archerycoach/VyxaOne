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
  });

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
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFillColor(28, 43, 51);
    doc.rect(0, 0, pageWidth, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("AVALIAÇÃO COMPARATIVA DE MERCADO", pageWidth / 2, 14, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(form.address, pageWidth / 2, 22, { align: "center" });

    doc.setTextColor(0, 0, 0);
    y = 42;

    if (result.suggestedMin && result.suggestedMax) {
      doc.setFillColor(243, 244, 246);
      doc.rect(10, y, pageWidth - 20, 20, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Valor Recomendado:", 15, y + 8);
      doc.setFontSize(14);
      doc.text(`${formatCurrency(result.suggestedMin)} — ${formatCurrency(result.suggestedMax)}`, 15, y + 16);
      y += 28;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Imóveis Comparáveis", 15, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    result.comparables.slice(0, 10).forEach((c) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const line = `${c.status === "sold" ? "[Vendido]" : "[Ativo]"} ${c.address} — ${c.area ? c.area + " m²" : ""} — ${formatCurrency(c.price)}`;
      doc.text(line, 15, y, { maxWidth: pageWidth - 30 });
      y += 6;
    });

    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Análise", 15, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const plainNarrative = result.narrative.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const splitText = doc.splitTextToSize(plainNarrative, pageWidth - 30);
    doc.text(splitText, 15, y);

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
