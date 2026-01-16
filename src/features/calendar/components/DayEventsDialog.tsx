import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventCard } from "./EventCard";
import { TaskCard } from "./TaskCard";
import type { CalendarEvent, Task } from "@/types";

interface DayEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  events: CalendarEvent[];
  tasks: Task[];
  onEventClick: (event: CalendarEvent) => void;
  onTaskClick: (task: Task) => void;
  onDeleteEvent?: (eventId: string) => void;
}

export function DayEventsDialog({
  open,
  onOpenChange,
  date,
  events,
  tasks,
  onEventClick,
  onTaskClick,
  onDeleteEvent,
}: DayEventsDialogProps) {
  const formattedDate = date.toLocaleDateString("pt-PT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const allItems = [
    ...events.map(e => ({ ...e, itemType: "event" as const })),
    ...tasks.map(t => ({ ...t, itemType: "task" as const }))
  ];

  allItems.sort((a, b) => {
    const dateA = new Date((a as any).startTime || (a as any).dueDate);
    const dateB = new Date((b as any).startTime || (b as any).dueDate);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{formattedDate}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {events.length === 0 && tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Sem eventos ou tarefas para este dia
            </p>
          ) : (
            <>
              {events.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-gray-700">
                    Eventos ({events.length})
                  </h3>
                  {events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => {
                        onEventClick(event);
                        onOpenChange(false);
                      }}
                      onDelete={(eventId) => {
                        if (onDeleteEvent) {
                          onDeleteEvent(eventId);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
              
              {tasks.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="font-semibold text-sm text-gray-700">
                    Tarefas ({tasks.length})
                  </h3>
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => {
                        onTaskClick(task);
                        onOpenChange(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}