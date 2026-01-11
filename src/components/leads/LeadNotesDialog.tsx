import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StickyNote, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface LeadNote {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
  } | null;
}

interface LeadNotesDialogProps {
  leadId: string;
  leadName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function LeadNotesDialog({ leadId, leadName, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: LeadNotesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = setControlledOpen ?? setInternalOpen;

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen, leadId]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_notes" as any)
        .select(`
          id,
          note,
          created_at,
          updated_at,
          profiles!lead_notes_created_by_fkey (
            full_name
          )
        `)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data as any) || []);
    } catch (error) {
      console.error("Error loading notes:", error);
      toast({
        title: "Erro ao carregar notas",
        description: "Não foi possível carregar as notas.",
        variant: "destructive",
      });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast({
        title: "Nota vazia",
        description: "Por favor, escreva algo na nota.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilizador não autenticado");

      const { error } = await supabase.from("lead_notes" as any).insert({
        lead_id: leadId,
        note: noteText,
        created_by: user.id,
      });

      if (error) throw error;

      toast({ title: "Nota adicionada com sucesso!" });
      setNoteText("");
      setIsAdding(false);
      await loadNotes();
    } catch (error) {
      console.error("Error adding note:", error);
      toast({
        title: "Erro ao adicionar nota",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!noteText.trim()) {
      toast({
        title: "Nota vazia",
        description: "Por favor, escreva algo na nota.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("lead_notes" as any)
        .update({ note: noteText })
        .eq("id", noteId);

      if (error) throw error;

      toast({ title: "Nota atualizada com sucesso!" });
      setNoteText("");
      setEditingNoteId(null);
      await loadNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      toast({
        title: "Erro ao atualizar nota",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta nota?")) return;

    try {
      const { error } = await supabase
        .from("lead_notes" as any)
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast({ title: "Nota apagada com sucesso!" });
      await loadNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Erro ao apagar nota",
        variant: "destructive",
      });
    }
  };

  const startEditing = (note: LeadNote) => {
    setEditingNoteId(note.id);
    setNoteText(note.note);
    setIsAdding(false);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setNoteText("");
  };

  const startAdding = () => {
    setIsAdding(true);
    setEditingNoteId(null);
    setNoteText("");
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setNoteText("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <StickyNote className="h-4 w-4" />
            Notas
            {notes.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {notes.length}
              </span>
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Notas - {leadName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4">
          {/* Add New Note Button */}
          {!isAdding && !editingNoteId && (
            <Button onClick={startAdding} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Nota
            </Button>
          )}

          {/* Add/Edit Note Form */}
          {(isAdding || editingNoteId) && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escreva a sua nota aqui..."
                rows={4}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    editingNoteId
                      ? handleUpdateNote(editingNoteId)
                      : handleAddNote()
                  }
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Guardando..."
                    : editingNoteId
                    ? "Atualizar Nota"
                    : "Adicionar Nota"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={editingNoteId ? cancelEditing : cancelAdding}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Notes List */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <StickyNote className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Ainda não há notas para esta lead.</p>
                  <p className="text-sm">Clique em "Nova Nota" para adicionar a primeira.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {note.profiles?.full_name || "Utilizador"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "PPp", {
                            locale: pt,
                          })}
                          {note.updated_at !== note.created_at && (
                            <span className="ml-1">(editado)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEditing(note)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}