import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Radar, Flame, Thermometer, PhoneCall, Clock, CircleCheck, Loader2, User, Users } from "lucide-react";
import {
  getRadarItems, registerRadarContact, snoozeRadarItem, resolveRadarItem,
  type RadarItemEnriched, type RadarResolveReason,
} from "@/services/radarService";

const STATE_META: Record<string, { label: string; dot: string; text: string }> = {
  overdue: { label: "Em atraso", dot: "bg-red-500", text: "text-red-600" },
  soon: { label: "A aproximar", dot: "bg-amber-500", text: "text-amber-600" },
  ok: { label: "Em dia", dot: "bg-green-500", text: "text-green-600" },
  snoozed: { label: "Adiado", dot: "bg-gray-400", text: "text-gray-500" },
};

const RESOLVE_LABELS: Record<RadarResolveReason, string> = {
  won: "Ganho",
  lost: "Perdido",
  not_interested: "Não interessado",
  other: "Outro",
};

export default function RadarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<RadarItemEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<RadarItemEnriched | null>(null);
  const [resolveReason, setResolveReason] = useState<RadarResolveReason>("won");

  const load = async () => {
    try {
      setItems(await getRadarItems());
    } catch (error) {
      console.error("Erro ao carregar Radar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = {
    overdue: items.filter((i) => i.state === "overdue").length,
    soon: items.filter((i) => i.state === "soon").length,
    ok: items.filter((i) => i.state === "ok").length,
    snoozed: items.filter((i) => i.state === "snoozed").length,
  };

  const handleRegister = async (item: RadarItemEnriched) => {
    setBusyId(item.id);
    try {
      await registerRadarContact(item.id);
      toast({ title: "Contacto registado", description: `Relógio do Radar reposto para ${item.name}.` });
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível registar.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleSnooze = async (item: RadarItemEnriched, days: number) => {
    setBusyId(item.id);
    try {
      await snoozeRadarItem(item.id, days);
      toast({ title: "Adiado", description: `${item.name} volta ao radar daqui a ${days} dias.` });
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível adiar.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setBusyId(resolveTarget.id);
    try {
      await resolveRadarItem(resolveTarget.id, resolveReason);
      toast({ title: "Resolvido", description: `${resolveTarget.name} saiu do Radar (${RESOLVE_LABELS[resolveReason]}).` });
      setResolveTarget(null);
      setResolveReason("won");
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível resolver.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const openEntity = (item: RadarItemEnriched) => {
    // `leadId` é o parâmetro que a página de Leads reconhece para abrir a ficha
    // (o `id` antigo era ignorado, por isso o clique não abria nada).
    if (item.entity_type === "lead") router.push(`/leads?leadId=${item.entity_id}`);
    else router.push(`/contacts`);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <SEO title="Radar - Vyxa One" description="Acompanhamento ativo de clientes quentes" />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="flex items-center gap-3 mb-1">
            <Radar className="h-7 w-7 text-indigo-600" />
            <h1 className="text-3xl font-bold">Radar</h1>
          </div>
          <p className="text-muted-foreground mb-6">
            Clientes quentes em acompanhamento ativo — não deixe nenhum ser esquecido até estar resolvido.
          </p>

          {!loading && items.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{counts.overdue} em atraso</Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{counts.soon} a aproximar</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{counts.ok} em dia</Badge>
              {counts.snoozed > 0 && (
                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">{counts.snoozed} adiados</Badge>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Radar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium">Ainda não tem ninguém no Radar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Marque uma lead ou contacto quente no seu detalhe para começar a acompanhar.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {items.map((item) => {
                  const meta = STATE_META[item.state];
                  const busy = busyId === item.id;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-4">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button className="font-medium hover:underline text-left" onClick={() => openEntity(item)}>
                            {item.name}
                          </button>
                          {item.entity_type === "lead" ? (
                            <Badge variant="outline" className="gap-1"><User className="h-3 w-3" />Lead</Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />Contacto</Badge>
                          )}
                          {item.temperature === "hot" && <Flame className="h-4 w-4 text-red-500" />}
                          {item.temperature === "warm" && <Thermometer className="h-4 w-4 text-amber-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          cadência {item.cadence_days}d{item.note ? ` · ${item.note}` : ""}
                        </div>
                      </div>
                      <div className={`text-sm text-right shrink-0 ${meta.text}`}>
                        {item.state === "snoozed"
                          ? "adiado"
                          : item.daysSinceActivity <= 0
                            ? "contacto hoje"
                            : `sem contacto há ${item.daysSinceActivity}d`}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" title="Registar contacto" disabled={busy} onClick={() => handleRegister(item)}>
                          <PhoneCall className="h-4 w-4 text-green-600" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="Adiar" disabled={busy}>
                              <Clock className="h-4 w-4 text-amber-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSnooze(item, 1)}>Adiar 1 dia</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSnooze(item, 3)}>Adiar 3 dias</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSnooze(item, 7)}>Adiar 7 dias</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" title="Resolver" disabled={busy} onClick={() => setResolveTarget(item)}>
                          <CircleCheck className="h-4 w-4 text-indigo-600" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver acompanhamento</DialogTitle>
              <DialogDescription>
                Retirar {resolveTarget?.name} do Radar. Indique o resultado (fica no histórico).
              </DialogDescription>
            </DialogHeader>
            <Select value={resolveReason} onValueChange={(v: RadarResolveReason) => setResolveReason(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="won">Ganho</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
                <SelectItem value="not_interested">Não interessado</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancelar</Button>
              <Button onClick={handleResolve} disabled={busyId === resolveTarget?.id}>Resolver</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
