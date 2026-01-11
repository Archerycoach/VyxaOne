import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CalendarHeaderProps {
  viewMode: "day" | "week" | "month";
  currentDate: Date;
  formatDate: (date: Date) => string;
  onNavigate: (direction: "prev" | "next") => void;
  onViewModeChange: (mode: "day" | "week" | "month") => void;
  onNewEvent: () => void;
  googleConnected: boolean;
  googleConfigured: boolean;
  isSyncing: boolean;
  onGoogleConnect: () => void;
  onGoogleSync: () => void;
  onGoogleDisconnect: () => void;
}

export function CalendarHeader({
  viewMode,
  currentDate,
  formatDate,
  onNavigate,
  onViewModeChange,
  onNewEvent,
  googleConnected,
  googleConfigured,
  isSyncing,
  onGoogleConnect,
  onGoogleSync,
  onGoogleDisconnect,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onNavigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <h2 className="text-lg font-semibold">{formatDate(currentDate)}</h2>
          </div>
          <Button variant="outline" size="icon" onClick={() => onNavigate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            variant={viewMode === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("day")}
          >
            Dia
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("week")}
          >
            Semana
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("month")}
          >
            Mês
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={onNewEvent}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Evento
        </Button>

        {googleConfigured && (
          <div className="flex gap-2">
            {googleConnected ? (
              <>
                <Button
                  variant="outline"
                  onClick={onGoogleSync}
                  disabled={isSyncing}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {isSyncing ? "A sincronizar..." : "Sincronizar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onGoogleDisconnect}
                  title="Desconectar Google Calendar"
                >
                  Desconectar
                </Button>
                <Badge variant="default" className="bg-green-500 px-3 py-1.5">
                  Google Conectado
                </Badge>
              </>
            ) : (
              <Button variant="outline" onClick={onGoogleConnect}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                Conectar Google
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}