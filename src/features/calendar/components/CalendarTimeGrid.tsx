import React, { useMemo, useRef } from "react";
import type { CalendarEvent, Task } from "@/types";

/**
 * Vista de grelha horária (Semana e Dia), ao estilo do Google Calendar:
 * horas à esquerda, dias em colunas, eventos posicionados pela hora com altura
 * proporcional à duração, linha vermelha da hora atual, eventos sobrepostos
 * lado a lado, e arrastar-e-largar para reposicionar (hora/dia).
 */

const HOUR_HEIGHT = 48; // px por hora
const DAY_MINUTES = 24 * 60;

interface CalendarTimeGridProps {
  viewMode: "day" | "week" | "month";
  currentDate: Date;
  events: CalendarEvent[];
  tasks: Task[];
  onEventClick: (event: CalendarEvent) => void;
  onTaskClick: (task: Task) => void;
  /** Reposicionar (drag) — o container grava start/end (evento) ou due (tarefa). */
  onRescheduleEvent: (id: string, newStartISO: string, newEndISO: string) => void;
  onRescheduleTask: (id: string, newDueISO: string) => void;
  /** Clique num espaço vazio → criar evento àquela hora. */
  onSlotClick?: (date: Date) => void;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

interface PositionedEvent {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

/** Distribui eventos sobrepostos em colunas (clusters de sobreposição). */
function layoutDayEvents(dayEvents: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day).getTime();
  const items = dayEvents
    .map((event) => {
      const s = new Date(event.startTime);
      const e = event.endTime ? new Date(event.endTime) : new Date(s.getTime() + 60 * 60000);
      // Recorta ao dia (eventos que atravessam a meia-noite).
      const startMin = Math.max(0, Math.round((s.getTime() - dayStart) / 60000));
      let endMin = Math.round((e.getTime() - dayStart) / 60000);
      if (endMin <= startMin) endMin = startMin + 30; // mínimo 30 min visíveis
      endMin = Math.min(DAY_MINUTES, endMin);
      return { event, startMin, endMin, col: 0, cols: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: PositionedEvent[] = [];
  let cluster: PositionedEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const colEnds: number[] = [];
    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= item.startMin) {
          colEnds[c] = item.endMin;
          item.col = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.col = colEnds.length;
        colEnds.push(item.endMin);
      }
    }
    const nCols = colEnds.length;
    cluster.forEach((it) => (it.cols = nCols));
    result.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of items) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) flush();
  return result;
}

function eventColor(event: CalendarEvent): string {
  if ((event as any).aiPending) return "bg-amber-100 border-amber-400 text-amber-900 border-dashed";
  if (!event.googleEventId) return "bg-purple-100 border-purple-300 text-purple-900";
  return "bg-blue-100 border-blue-300 text-blue-900";
}

export function CalendarTimeGrid({
  viewMode,
  currentDate,
  events,
  tasks,
  onEventClick,
  onTaskClick,
  onRescheduleEvent,
  onRescheduleTask,
  onSlotClick,
}: CalendarTimeGridProps) {
  const dragRef = useRef<{ kind: "event" | "task"; id: string; durationMin: number } | null>(null);

  const days = useMemo(() => {
    if (viewMode === "day") return [new Date(currentDate)];
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay()); // domingo
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewMode, currentDate]);

  const now = new Date();
  const nowMin = minutesOfDay(now);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const computeDropMinutes = (e: React.DragEvent, columnEl: HTMLElement): number => {
    const rect = columnEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let min = Math.round((y / HOUR_HEIGHT) * 60);
    min = Math.round(min / 15) * 15; // snap a 15 min
    return Math.max(0, Math.min(DAY_MINUTES - 15, min));
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const drag = dragRef.current;
    if (!drag) return;
    const min = computeDropMinutes(e, e.currentTarget as HTMLElement);
    const newStart = startOfDay(day);
    newStart.setMinutes(min);
    if (drag.kind === "event") {
      const newEnd = new Date(newStart.getTime() + drag.durationMin * 60000);
      onRescheduleEvent(drag.id, newStart.toISOString(), newEnd.toISOString());
    } else {
      onRescheduleTask(drag.id, newStart.toISOString());
    }
    dragRef.current = null;
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Cabeçalho dos dias */}
      <div className="flex border-b bg-gray-50 sticky top-0 z-10">
        <div className="w-14 shrink-0 border-r" />
        {days.map((day) => {
          const isToday = sameDay(day, now);
          return (
            <div key={day.toISOString()} className="flex-1 text-center py-2 border-r last:border-r-0">
              <div className="text-xs text-gray-500 uppercase">{WEEKDAY_LABELS[day.getDay()]}</div>
              <div className={`text-lg font-semibold ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grelha horária (scroll vertical) */}
      <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
        <div className="flex relative" style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Coluna das horas */}
          <div className="w-14 shrink-0 border-r">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-1 text-[11px] text-gray-400">
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {days.map((day) => {
            const dayStart = startOfDay(day);
            const dayEvents = events.filter((ev) => sameDay(new Date(ev.startTime), day));
            const dayTasks = tasks.filter((t) => t.dueDate && sameDay(new Date(t.dueDate), day));
            const positioned = layoutDayEvents(dayEvents, day);
            const isToday = sameDay(day, now);

            return (
              <div
                key={day.toISOString()}
                className="flex-1 relative border-r last:border-r-0"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Linhas das horas (cliques criam evento) */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => {
                      if (!onSlotClick) return;
                      const d = new Date(dayStart);
                      d.setHours(h, 0, 0, 0);
                      onSlotClick(d);
                    }}
                  />
                ))}

                {/* Linha da hora atual */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: (nowMin / 60) * HOUR_HEIGHT }}>
                    <div className="h-0.5 bg-red-500" />
                    <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}

                {/* Eventos posicionados */}
                {positioned.map(({ event, startMin, endMin, col, cols }) => {
                  const top = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(18, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2);
                  const widthPct = 100 / cols;
                  const start = new Date(event.startTime);
                  return (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={() => {
                        const s = new Date(event.startTime);
                        const e = event.endTime ? new Date(event.endTime) : new Date(s.getTime() + 60 * 60000);
                        dragRef.current = { kind: "event", id: event.id, durationMin: Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000)) };
                      }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className={`absolute rounded border px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden cursor-pointer shadow-sm ${eventColor(event)}`}
                      style={{ top, height, left: `calc(${col * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                      title={event.title}
                    >
                      <div className="font-medium truncate">
                        {start.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} {event.title}
                      </div>
                    </div>
                  );
                })}

                {/* Tarefas (chips à hora do prazo) */}
                {dayTasks.map((task) => {
                  const due = new Date(task.dueDate!);
                  const top = (minutesOfDay(due) / 60) * HOUR_HEIGHT;
                  return (
                    <div
                      key={`task-${task.id}`}
                      draggable
                      onDragStart={() => { dragRef.current = { kind: "task", id: task.id, durationMin: 0 }; }}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                      className="absolute right-1 left-1 z-10 rounded border border-blue-200 bg-blue-50 text-blue-900 px-1.5 py-0.5 text-[11px] cursor-pointer truncate"
                      style={{ top }}
                      title={task.title}
                    >
                      ✓ {task.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
