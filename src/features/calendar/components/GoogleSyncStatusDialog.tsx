import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface GoogleSyncStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

interface SyncRow {
  id: string;
  title: string;
  when: string | null;
  kind: "Evento" | "Tarefa";
  synced: boolean;
}

// Mostra, dentro do calendário, que eventos/tarefas já foram sincronizados
// com o Google Calendar (têm google_event_id) e quais ainda estão por
// sincronizar — um registo simples baseado no estado real de cada registo.
export function GoogleSyncStatusDialog({ open, onOpenChange, onSync, isSyncing }: GoogleSyncStatusDialogProps) {
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRows([]);
        return;
      }

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const until = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: events }, { data: tasks }] = await Promise.all([
        supabase
          .from("calendar_events")
          .select("id, title, start_time, google_event_id")
          .eq("user_id", user.id)
          .gte("start_time", since)
          .lte("start_time", until)
          .order("start_time", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, due_date, google_event_id")
          .eq("user_id", user.id)
          .not("due_date", "is", null)
          .gte("due_date", since)
          .lte("due_date", until)
          .order("due_date", { ascending: false }),
      ]);

      const eventRows: SyncRow[] = (events || []).map((e: any) => ({
        id: e.id,
        title: e.title || "(sem título)",
        when: e.start_time,
        kind: "Evento",
        synced: !!e.google_event_id,
      }));
      const taskRows: SyncRow[] = (tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title || "(sem título)",
        when: t.due_date,
        kind: "Tarefa",
        synced: !!t.google_event_id,
      }));

      const all = [...eventRows, ...taskRows].sort((a, b) => {
        const av = a.when ? new Date(a.when).getTime() : 0;
        const bv = b.when ? new Date(b.when).getTime() : 0;
        return bv - av;
      });
      setRows(all);
    } catch (err) {
      console.error("[GoogleSyncStatusDialog] Erro ao carregar estado de sincronização:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const formatWhen = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const syncedCount = rows.filter((r) => r.synced).length;
  const pendingCount = rows.length - syncedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Estado da sincronização com o Google</DialogTitle>
          <DialogDescription>
            Eventos e tarefas dos últimos 30 dias e próximos 90 dias, e se já estão no seu Google Calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="bg-green-600">{syncedCount} sincronizados</Badge>
          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">{pendingCount} por sincronizar</Badge>
          {onSync && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={onSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "A sincronizar..." : "Sincronizar agora"}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-3">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">A carregar...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Não há eventos nem tarefas neste período.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{row.title}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">{row.kind}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatWhen(row.when)}</p>
                  </div>
                  {row.synced ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                      <Check className="h-4 w-4" />
                      Sincronizado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                      <Clock className="h-4 w-4" />
                      Por sincronizar
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
