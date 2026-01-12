import React from "react";
import { Trash2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarNote } from "../hooks/useCalendarNotes";

interface NoteCardProps {
  note: CalendarNote;
  onClick?: () => void;
  onDelete?: (noteId: string) => void;
  compact?: boolean;
}

export function NoteCard({ 
  note, 
  onClick, 
  onDelete,
  compact = false 
}: NoteCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm("Tem certeza que deseja eliminar esta nota?")) {
      onDelete(note.id);
    }
  };

  const noteTime = new Date(note.created_at).toLocaleTimeString("pt-PT", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  if (compact) {
    return (
      <div 
        className="text-xs rounded p-1.5 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 cursor-pointer transition-colors relative group"
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0 text-yellow-900">
            <StickyNote className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-medium">{note.lead_name || "Nota"}</span>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="text-[10px] text-yellow-800 opacity-70 mt-0.5">
          {noteTime}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="p-3 border rounded-lg bg-yellow-50 border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer relative group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StickyNote className="h-4 w-4 text-yellow-700" />
            <span className="text-xs font-medium text-yellow-700">Nota</span>
            <span className="text-xs text-yellow-700 opacity-70">
              {noteTime}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            {note.lead_name || "Lead sem nome"}
          </p>
          <p className="text-sm text-gray-600 line-clamp-2">{note.note}</p>
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}