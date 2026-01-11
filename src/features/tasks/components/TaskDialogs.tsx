import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/types";

interface TaskDialogsProps {
  // Form Dialog
  formDialogOpen: boolean;
  onFormDialogOpenChange: (open: boolean) => void;
  editingTask: Task | null;
  formData: {
    title: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string;
    relatedLeadId: string;
    relatedPropertyId: string;
    assignedToId: string;
  };
  onFormDataChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;

  // Notes Dialog
  notesDialogOpen: boolean;
  onNotesDialogOpenChange: (open: boolean) => void;
  notesTask: Task | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onNotesSubmit: () => void;

  // Data for selects
  leads: any[];
  properties: any[];
  users: any[];
}

export function TaskDialogs({
  formDialogOpen,
  onFormDialogOpenChange,
  editingTask,
  formData,
  onFormDataChange,
  onSubmit,
  submitting,
  notesDialogOpen,
  onNotesDialogOpenChange,
  notesTask,
  notes,
  onNotesChange,
  onNotesSubmit,
  leads,
  properties,
  users,
}: TaskDialogsProps) {
  return (
    <>
      {/* Task Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={onFormDialogOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => onFormDataChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => onFormDataChange("description", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => onFormDataChange("priority", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => onFormDataChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate">Data de Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => onFormDataChange("dueDate", e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assignedTo">Atribuído a</Label>
                <Select
                  value={formData.assignedToId}
                  onValueChange={(value) => onFormDataChange("assignedToId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lead">Lead Relacionado</Label>
                <Select
                  value={formData.relatedLeadId}
                  onValueChange={(value) => onFormDataChange("relatedLeadId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="property">Imóvel Relacionado</Label>
                <Select
                  value={formData.relatedPropertyId}
                  onValueChange={(value) => onFormDataChange("relatedPropertyId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um imóvel..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onFormDialogOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : editingTask ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={onNotesDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Notas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {notesTask && (
              <div className="space-y-2">
                <h4 className="font-medium">{notesTask.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {notesTask.description}
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={5}
                placeholder="Adicione notas sobre esta tarefa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onNotesDialogOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button onClick={onNotesSubmit} disabled={submitting}>
              Salvar Notas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}