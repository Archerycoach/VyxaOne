import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, ListChecks, RefreshCw, ChevronDown } from "lucide-react";
import { BookingLinkButton } from "@/components/BookingLinkButton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface CalendarHeaderProps {
  viewMode: "day" | "week" | "month";
  currentDate: Date;
  formatDate: (date: Date) => string;
  onNavigate: (direction: "prev" | "next") => void;
  onToday?: () => void;
  onViewModeChange: (mode: "day" | "week" | "month") => void;
  onNewEvent: () => void;
  onCopyBookingLink?: () => void;
  googleConnected: boolean;
  googleConfigured: boolean;
  isSyncing: boolean;
  onGoogleConnect: () => void;
  onGoogleSync: () => void;
  onGoogleDisconnect: () => void;
  onShowSyncStatus?: () => void;
  onRefreshEvents?: () => void;
  onRefreshTasks?: () => void;
  // Sincronização automática (estado gerido pelo container)
  autoSyncEnabled?: boolean | null;
  onToggleAutoSync?: (next: boolean) => void;
}

export function CalendarHeader({
  viewMode,
  currentDate,
  formatDate,
  onNavigate,
  onToday,
  onViewModeChange,
  onNewEvent,
  onCopyBookingLink,
  googleConnected,
  googleConfigured,
  isSyncing,
  onGoogleConnect,
  onGoogleSync,
  onGoogleDisconnect,
  onShowSyncStatus,
  onRefreshEvents,
  onRefreshTasks,
  autoSyncEnabled,
  onToggleAutoSync,
}: CalendarHeaderProps) {
  const handleSync = async () => {
    await onGoogleSync();
    // Refresh data after sync
    if (onRefreshEvents) onRefreshEvents();
    if (onRefreshTasks) onRefreshTasks();
  };

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
          {onToday && (
            <Button variant="outline" size="sm" onClick={onToday}>
              Hoje
            </Button>
          )}
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

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onNewEvent}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Evento
        </Button>

        {onCopyBookingLink && <BookingLinkButton />}

        {googleConfigured && (
          googleConnected ? (
            <>
              {/* Botão rápido de sincronizar + menu com as restantes opções */}
              <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "A sincronizar..." : "Sincronizar"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    Google
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    Google Calendar conectado
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {onShowSyncStatus && (
                    <DropdownMenuItem onClick={onShowSyncStatus}>
                      <ListChecks className="mr-2 h-4 w-4" />
                      Estado da sincronização
                    </DropdownMenuItem>
                  )}

                  {/* Sincronização automática (toggle dentro do menu) */}
                  {autoSyncEnabled !== null && autoSyncEnabled !== undefined && onToggleAutoSync && (
                    <div
                      className="flex items-center justify-between px-2 py-1.5 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="flex items-center">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync automática
                      </span>
                      <Switch
                        checked={autoSyncEnabled}
                        onCheckedChange={onToggleAutoSync}
                        aria-label="Sincronização automática"
                      />
                    </div>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onGoogleDisconnect}
                    className="text-red-600 focus:text-red-600"
                  >
                    Desconectar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="outline" onClick={onGoogleConnect}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              Conectar Google
            </Button>
          )
        )}
      </div>
    </div>
  );
}
