import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Link, RefreshCw, CalendarIcon } from "lucide-react";

type ViewMode = "day" | "week" | "month";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: ViewMode;
  formatDate: (date: Date) => string;
  onNavigate: (direction: "prev" | "next") => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNewEvent: () => void;
  googleConnected: boolean;
  googleConfigured: boolean;
  isSyncing: boolean;
  onGoogleConnect: () => void;
  onGoogleSync: () => void;
}

export function CalendarHeader({
  currentDate,
  viewMode,
  formatDate,
  onNavigate,
  onViewModeChange,
  onNewEvent,
  googleConnected,
  googleConfigured,
  isSyncing,
  onGoogleConnect,
  onGoogleSync,
}: CalendarHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-600 mt-1">Gerir eventos e compromissos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onGoogleConnect}
            className="flex items-center gap-2"
          >
            {googleConnected ? (
              <>
                <CalendarIcon className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Conectado</span>
              </>
            ) : (
              <>
                <Link className="h-4 w-4" />
                Conectar Google
              </>
            )}
          </Button>
          {googleConnected && (
            <Button 
              variant="default"
              onClick={onGoogleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "A sincronizar..." : "Sincronizar Agora"}
            </Button>
          )}
          <Button onClick={onNewEvent} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-5 w-5 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => onNavigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{formatDate(currentDate)}</h2>
          <Button variant="outline" size="sm" onClick={() => onNavigate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("day")}
          >
            Dia
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("week")}
          >
            Semana
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("month")}
          >
            Mês
          </Button>
        </div>
      </div>
    </div>
  );
}