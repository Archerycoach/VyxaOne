import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MessageCircle, Users, Home, StickyNote, Activity, Loader2 } from "lucide-react";
import {
  getActivityMetrics,
  resolveActivityRange,
  type ActivityCounts,
  type ActivityPeriodKey,
} from "@/services/activityMetricsService";

interface ActivityWidgetProps {
  /** Consultor a analisar. Omitir = o próprio (via sessão). */
  agentId?: string | null;
}

const PRESETS: { key: ActivityPeriodKey; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "month", label: "Este mês" },
];

const ITEMS: { key: keyof ActivityCounts; label: string; icon: any; color: string }[] = [
  { key: "calls", label: "Chamadas", icon: Phone, color: "text-blue-600 bg-blue-100" },
  { key: "emails", label: "Emails", icon: Mail, color: "text-indigo-600 bg-indigo-100" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600 bg-green-100" },
  { key: "meetings", label: "Reuniões", icon: Users, color: "text-purple-600 bg-purple-100" },
  { key: "visits", label: "Visitas", icon: Home, color: "text-amber-600 bg-amber-100" },
  { key: "notes", label: "Notas", icon: StickyNote, color: "text-slate-600 bg-slate-100" },
];

export function ActivityWidget({ agentId }: ActivityWidgetProps) {
  const [period, setPeriod] = useState<ActivityPeriodKey>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [counts, setCounts] = useState<ActivityCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Em modo custom, só carrega quando ambas as datas estiverem preenchidas.
    if (period === "custom" && (!customFrom || !customTo)) return;

    let active = true;
    setLoading(true);
    const range = resolveActivityRange(period, customFrom, customTo);
    getActivityMetrics(range, agentId || undefined)
      .then((c) => { if (active) setCounts(c); })
      .catch((e) => { console.error("[ActivityWidget]", e); if (active) setCounts(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, customFrom, customTo, agentId]);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          A minha atividade
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "default" : "outline"}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={period === "custom" ? "default" : "outline"}
            onClick={() => setPeriod("custom")}
          >
            Datas
          </Button>
        </div>
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground text-sm">até</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="rounded-lg border p-3 text-center">
                  <div className={`mx-auto mb-2 h-9 w-9 rounded-full flex items-center justify-center ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold">{counts?.[item.key] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Total de ações no período: <span className="font-semibold text-foreground">{counts?.total ?? 0}</span>
          </p>
        </>
      )}
    </Card>
  );
}
