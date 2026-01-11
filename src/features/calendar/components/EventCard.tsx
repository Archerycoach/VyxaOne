import React from "react";
import { Clock, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/types";

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  compact?: boolean;
}

export function EventCard({
  event,
  onClick,
  onDragStart,
  onDragEnd,
  compact = false,
}: EventCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  if (compact) {
    return (
      <div 
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="text-xs rounded p-1 truncate cursor-move transition-opacity bg-purple-100 hover:bg-purple-200"
        onClick={handleClick}
      >
        <div className="font-medium">
          {new Date(event.startTime).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="truncate">{event.title}</div>
      </div>
    );
  }

  return (
    <div 
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="border rounded-lg p-4 cursor-move transition-opacity bg-purple-50 hover:bg-purple-100"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{event.title}</h3>
            {event.googleEventId && (
              <Badge variant="outline" className="text-xs">
                <CalendarIcon className="h-3 w-3 mr-1" />
                Google
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(event.startTime).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="capitalize">
              {event.eventType === "meeting" ? "Reunião" :
               event.eventType === "viewing" ? "Visita" :
               event.eventType === "call" ? "Chamada" :
               event.eventType === "followup" ? "Follow-up" :
               "Outro"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}