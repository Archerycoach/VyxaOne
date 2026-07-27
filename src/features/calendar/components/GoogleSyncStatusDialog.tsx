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
import { Check, Clock, RefreshCw, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoogleCalendarOption {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
}

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
  const { toast } = useToast();
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Calendários da conta Google e quais estão a ser importados.
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([]);
  const [primaryCalendarId, setPrimaryCalendarId] = useState<string>("");
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` };
  };

  const loadCalendars = async () => {
    setLoadingCalendars(true);
    try {
      const res = await fetch("/api/google-calendar/calendars", { headers: await authHeader() });
      if (!res.ok) return; // não ligado / sem permissão — secção fica escondida
      const data = await res.json();
      setCalendars(Array.isArray(data.calendars) ? data.calendars : []);
      setPrimaryCalendarId(data.primaryCalendarId || "");
      setSelectedImports(new Set(Array.isArray(data.selected) ? data.selected : []));
    } catch {
      /* silencioso — a secção só aparece se houver calendários */
    } finally {
      setLoadingCalendars(false);
    }
  };

  const toggleCalendar = async (id: string) => {
    const next = new Set(selectedImports);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedImports(next);
    setSavingCalendars(true);
    try {
      const res = await fetch("/api/google-calendar/calendars", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ calendarIds: Array.from(next) }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Calendários atualizados", description: "Sincronize para importar os eventos." });
    } catch {
      setSelectedImports(selectedImports); // reverte
      toast({ title: "Não foi possível guardar", variant: "destructive" });
    } finally {
      setSavingCalendars(false);
    }
  };

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
    if (open) {
      load();
      loadCalendars();
    }
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

        {/* Calendários a importar — só aparece se houver mais do que o principal. */}
        {calendars.length > 1 && (
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Calendários Google a importar
              {savingCalendars && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {calendars.map((c) => {
                const isPrimary = c.id === primaryCalendarId || c.primary;
                const checked = isPrimary || selectedImports.has(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={checked}
                      disabled={isPrimary || savingCalendars}
                      onCheckedChange={() => !isPrimary && toggleCalendar(c.id)}
                    />
                    {c.backgroundColor && (
                      <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: c.backgroundColor }} />
                    )}
                    <span className="truncate">{c.summary}</span>
                    {isPrimary && <Badge variant="outline" className="text-[10px]">principal</Badge>}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              O principal é sempre incluído. Escolha os restantes para os eventos aparecerem na agenda Vyxa.
            </p>
          </div>
        )}

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
