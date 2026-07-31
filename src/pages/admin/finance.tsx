import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Bot, Euro, Loader2, RefreshCw } from "lucide-react";

interface FinanceData {
  fxRate: number;
  ai: {
    usd: number; eur: number; calls: number; inputTokens: number; outputTokens: number;
    byModel: { model: string; calls: number; usd: number; eur: number; inputTokens: number; outputTokens: number }[];
    byTask: { task: string; calls: number; usd: number; eur: number }[];
  };
  revenue: { receivedEur: number; payments: number; recent: { date: string; amount: number; currency: string; method: string }[] };
  mrr: { monthlyEur: number; arrEur: number; activeCount: number; trialingCount: number };
  net: { profitEur: number };
}

const eur = (n: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat("pt-PT").format(n || 0);

const PERIODS = [
  { value: "month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "quarter", label: "Últimos 90 dias" },
  { value: "year", label: "Este ano" },
  { value: "all", label: "Tudo" },
];

export default function AdminFinance() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceData | null>(null);
  const [period, setPeriod] = useState("month");
  const [fxInput, setFxInput] = useState("");
  const [savingFx, setSavingFx] = useState(false);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");
      const res = await fetch(`/api/admin/finance?period=${p}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha ao carregar");
      setData(body);
      setFxInput(String(body.fxRate));
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(period); }, [period, load]);

  const saveFx = async () => {
    setSavingFx(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fxRate: parseFloat(fxInput) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha");
      toast({ title: "Taxa guardada", description: "Os custos passam a converter por esta taxa." });
      load(period);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSavingFx(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-6 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Euro className="h-7 w-7 text-emerald-600" /> Custos & Proveitos
              </h1>
              <p className="text-slate-600 mt-1">Consumo de IA e contabilidade (receitas vs. custos), em EUR.</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => load(period)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {!data ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-600" /> Receita recebida</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold text-slate-900">{eur(data.revenue.receivedEur)}</p><p className="text-xs text-slate-500">{data.revenue.payments} pagamento(s) no período</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 flex items-center gap-1.5"><Bot className="h-4 w-4 text-indigo-600" /> Custo de IA</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold text-slate-900">{eur(data.ai.eur)}</p><p className="text-xs text-slate-500">{num(data.ai.calls)} chamadas · ${data.ai.usd.toFixed(2)} USD</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 flex items-center gap-1.5">{data.net.profitEur >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />} Lucro líquido</CardTitle></CardHeader>
                  <CardContent><p className={`text-2xl font-bold ${data.net.profitEur >= 0 ? "text-emerald-700" : "text-red-700"}`}>{eur(data.net.profitEur)}</p><p className="text-xs text-slate-500">Receita − custo de IA</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 flex items-center gap-1.5"><Euro className="h-4 w-4 text-blue-600" /> MRR (recorrente)</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold text-slate-900">{eur(data.mrr.monthlyEur)}</p><p className="text-xs text-slate-500">ARR {eur(data.mrr.arrEur)} · {data.mrr.activeCount} ativas, {data.mrr.trialingCount} trial</p></CardContent>
                </Card>
              </div>

              {/* Taxa de câmbio */}
              <Card>
                <CardContent className="pt-5 flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-sm">Taxa de câmbio USD → EUR</Label>
                    <p className="text-xs text-slate-500 mb-1.5">Os custos de IA são faturados em USD; esta taxa converte-os para EUR. Atual: 1 USD = {data.fxRate} EUR.</p>
                    <Input type="number" step="0.01" min="0" value={fxInput} onChange={(e) => setFxInput(e.target.value)} className="w-40" />
                  </div>
                  <Button onClick={saveFx} disabled={savingFx || parseFloat(fxInput) === data.fxRate}>
                    {savingFx ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null} Guardar taxa
                  </Button>
                </CardContent>
              </Card>

              {/* Custo por modelo */}
              <Card>
                <CardHeader><CardTitle className="text-base">Custo de IA por modelo</CardTitle></CardHeader>
                <CardContent>
                  {data.ai.byModel.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem consumo de IA no período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Modelo</TableHead><TableHead className="text-right">Chamadas</TableHead><TableHead className="text-right">Tokens (in/out)</TableHead><TableHead className="text-right">Custo (EUR)</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {data.ai.byModel.map((m) => (
                            <TableRow key={m.model}>
                              <TableCell className="font-medium">{m.model}</TableCell>
                              <TableCell className="text-right">{num(m.calls)}</TableCell>
                              <TableCell className="text-right text-slate-500">{num(m.inputTokens)} / {num(m.outputTokens)}</TableCell>
                              <TableCell className="text-right font-medium">{eur(m.eur)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Custo por tarefa */}
              <Card>
                <CardHeader><CardTitle className="text-base">Custo de IA por funcionalidade</CardTitle></CardHeader>
                <CardContent>
                  {data.ai.byTask.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem consumo de IA no período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Funcionalidade</TableHead><TableHead className="text-right">Chamadas</TableHead><TableHead className="text-right">Custo (EUR)</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {data.ai.byTask.map((t) => (
                            <TableRow key={t.task}>
                              <TableCell className="font-medium">{t.task}</TableCell>
                              <TableCell className="text-right">{num(t.calls)}</TableCell>
                              <TableCell className="text-right font-medium">{eur(t.eur)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagamentos recentes */}
              <Card>
                <CardHeader><CardTitle className="text-base">Pagamentos recebidos (recentes)</CardTitle></CardHeader>
                <CardContent>
                  {data.revenue.recent.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem pagamentos concluídos no período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {data.revenue.recent.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell>{new Date(p.date).toLocaleDateString("pt-PT")}</TableCell>
                              <TableCell className="capitalize">{p.method}</TableCell>
                              <TableCell className="text-right font-medium">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: p.currency || "EUR" }).format(p.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-slate-400">
                Nota: modelos de IA sem preço na tabela interna são registados com custo 0 — se vir chamadas com custo nulo, é preciso adicionar o preço do modelo. Receita = pagamentos concluídos (em EUR) no período; MRR = receita recorrente mensal das subscrições ativas (snapshot atual).
              </p>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
