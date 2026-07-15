import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radar, AlertTriangle, ChevronRight } from "lucide-react";
import { getRadarSummary, type RadarItemEnriched } from "@/services/radarService";

export function RadarWidget() {
  const router = useRouter();
  const [summary, setSummary] = useState<{ total: number; overdue: number; topOverdue: RadarItemEnriched[] } | null>(null);

  useEffect(() => {
    getRadarSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  // Só mostra o widget quando há alguém no Radar (evita ruído).
  if (!summary || summary.total === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Radar className="h-5 w-5 text-indigo-600" />
        <span className="font-medium">No Radar</span>
        <span className="ml-auto text-2xl font-bold">{summary.total}</span>
      </div>

      {summary.overdue > 0 ? (
        <div className="flex items-center gap-1.5 text-sm text-red-600 mb-3">
          <AlertTriangle className="h-4 w-4" />
          {summary.overdue} {summary.overdue === 1 ? "precisa" : "precisam"} de atenção
        </div>
      ) : (
        <div className="text-sm text-green-600 mb-3">Tudo em dia</div>
      )}

      {summary.topOverdue.length > 0 && (
        <div className="space-y-1 mb-4">
          {summary.topOverdue.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-gray-700 dark:text-gray-300">{item.name}</span>
              <span className="text-red-600 shrink-0 ml-2">há {item.daysSinceActivity}d</span>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={() => router.push("/radar")}>
        Ver Radar
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </Card>
  );
}
