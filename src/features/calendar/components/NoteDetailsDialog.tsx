import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StickyNote, Calendar, User, FileText, ExternalLink } from "lucide-react";
import type { CalendarNote } from "../hooks/useCalendarNotes";
import { useRouter } from "next/router";

interface NoteDetailsDialogProps {
  note: CalendarNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteDetailsDialog({
  note,
  open,
  onOpenChange,
}: NoteDetailsDialogProps) {
  const router = useRouter();

  if (!note) return null;

  const handleGoToLead = () => {
    if (note.lead_id) {
      router.push(`/leads?highlight=${note.lead_id}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-yellow-600" />
            Detalhes da Nota
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead Associado */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Lead</span>
              </div>
              {note.lead_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToLead}
                  className="gap-2"
                >
                  Ver Lead
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="font-medium">{note.lead_name || "Lead sem nome"}</p>
            </div>
          </div>

          {/* Data de Criação */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Data</span>
            </div>
            <p className="text-base p-3 bg-gray-50 rounded-lg">
              {new Date(note.created_at).toLocaleString("pt-PT", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>

          {/* Conteúdo da Nota */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Nota</span>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {note.note}
              </p>
            </div>
          </div>

          {/* Autor da Nota */}
          {note.created_by_name && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Criado por</span>
              </div>
              <p className="text-base p-3 bg-gray-50 rounded-lg">
                {note.created_by_name}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}