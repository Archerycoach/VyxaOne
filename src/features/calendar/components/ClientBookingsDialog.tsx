import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, CalendarDays, Loader2, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setEventCompleted } from "@/services/calendarService";
import { useToast } from "@/hooks/use-toast";

interface ClientBooking {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  completed_at: string | null;
  lead_id: string | null;
  attendees: Array<{ name?: string; email?: string; phone?: string | null }> | null;
}

interface ClientBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Salta o calendário para o dia da reserva (vista Dia). */
  onGoToDate: (date: Date) => void;
  /** Refresca a grelha do calendário depois de marcar realizado. */
  onChanged: () => void;
}

/**
 * Reservas feitas pelos clientes através do link de agendamento — visão
 * dedicada para o consultor ver o que está planeado e o que já foi realizado,
 * sem andar a caçá-las na grelha. Identificadas por booked_by_client
 * (migração 20260813150000).
 */
export function ClientBookingsDialog({ open, onOpenChange, onGoToDate, onChanged }: ClientBookingsDialogProps) {
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessão expirada.");
        const { data, error } = await (supabase.from("calendar_events") as any)
          .select("id, title, description, start_time, end_time, completed_at, lead_id, attendees")
          .eq("user_id", user.id)
          .eq("booked_by_client", true)
          .order("start_time", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!cancelled) setBookings((data || []) as ClientBooking[]);
      } catch (error: any) {
        toast({ title: "Erro ao carregar as reservas", description: error.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const handleToggleDone = async (booking: ClientBooking) => {
    const next = !booking.completed_at;
    setTogglingId(booking.id);
    try {
      await setEventCompleted(booking.id, next);
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, completed_at: next ? new Date().toISOString() : null } : b))
      );
      onChanged();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => new Date(b.start_time).getTime() >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = bookings.filter((b) => new Date(b.start_time).getTime() < now);

  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString("pt-PT", {
      weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  const clientOf = (b: ClientBooking) => {
    const attendee = Array.isArray(b.attendees) ? b.attendees[0] : null;
    return {
      name: attendee?.name || b.title.replace(/^Chamada agendada - /, ""),
      email: attendee?.email || null,
      phone: attendee?.phone || null,
    };
  };

  const renderBooking = (b: ClientBooking, isPast: boolean) => {
    const client = clientOf(b);
    const done = Boolean(b.completed_at);
    return (
      <div key={b.id} className={`rounded-lg border p-3 ${done ? "bg-gray-50" : "bg-white"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-medium text-sm ${done ? "line-through text-gray-500" : ""}`}>{client.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatWhen(b.start_time)}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-600">
              {client.email && (
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>
              )}
              {client.phone && (
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {done ? (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Realizada</Badge>
            ) : isPast ? (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Por confirmar</Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Planeada</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onGoToDate(new Date(b.start_time));
              onOpenChange(false);
            }}
          >
            <CalendarDays className="h-3 w-3 mr-1" /> Ver no calendário
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={togglingId === b.id}
            onClick={() => handleToggleDone(b)}
          >
            {togglingId === b.id ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Check className={`h-3 w-3 mr-1 ${done ? "text-gray-400" : "text-emerald-600"}`} />
            )}
            {done ? "Desmarcar realizada" : "Marcar realizada"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reservas de clientes</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            Ainda não há reservas feitas por clientes através do seu link de agendamento.
          </p>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Planeadas ({upcoming.length})</p>
                <div className="space-y-2">
                  {upcoming.length > 0
                    ? upcoming.map((b) => renderBooking(b, false))
                    : <p className="text-sm text-gray-400">Sem reservas futuras.</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Passadas ({past.length})</p>
                <div className="space-y-2">
                  {past.length > 0
                    ? past.map((b) => renderBooking(b, true))
                    : <p className="text-sm text-gray-400">Ainda sem histórico.</p>}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
