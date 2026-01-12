import React, { useState } from "react";
import { Clock, CalendarIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CalendarEvent } from "@/types";

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
  onDelete?: (eventId: string) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  compact?: boolean;
}

export function EventCard({
  event,
  onClick,
  onDelete,
  onDragStart,
  onDragEnd,
  compact = false,
}: EventCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (onDelete) {
      await onDelete(event.id);
    }
    setShowDeleteDialog(false);
  };

  if (compact) {
    return (
      <>
        <div 
          draggable={!!onDragStart}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="text-xs rounded p-1 truncate cursor-move transition-opacity bg-purple-100 hover:bg-purple-200 group relative"
          onClick={handleClick}
        >
          <div className="font-medium">
            {new Date(event.startTime).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="truncate">{event.title}</div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar evento?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza que deseja eliminar o evento "{event.title}"? Esta ação não pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <div 
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="border rounded-lg p-4 cursor-move transition-opacity bg-purple-50 hover:bg-purple-100 group relative"
        onClick={handleClick}
      >
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
        
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-10">
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar o evento "{event.title}"? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}