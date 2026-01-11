import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CheckCircle2, Clock, AlertCircle, List, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TaskCard } from "./TaskCard";
import { TaskFilters } from "./TaskFilters";
import { TaskDialogs } from "./TaskDialogs";
import { useTasks, useTaskFilters, useTaskMutations } from "../hooks";
import { getLeads } from "@/services/leadsService";
import { getProperties } from "@/services/propertiesService";
import type { Task } from "@/types";

export function TasksContainer() {
  const { toast } = useToast();
  const { tasks, stats, isLoading, refetch } = useTasks();
  const { filter, setFilter, searchTerm, setSearchTerm, filteredTasks } = useTaskFilters(tasks);
  const { submitting, handleCreate, handleUpdate, handleComplete, handleDelete } = useTaskMutations(refetch);

  // Form state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    dueDate: "",
    relatedLeadId: "",
    relatedPropertyId: "",
    assignedToId: "",
  });

  // Notes dialog state
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesTask, setNotesTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState("");

  // Data for selects
  const [leads, setLeads] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadSelectData();
  }, []);

  const loadSelectData = async () => {
    try {
      const [leadsData, propertiesData] = await Promise.all([
        getLeads(),
        getProperties(),
      ]);
      setLeads(leadsData);
      setProperties(propertiesData);
    } catch (error) {
      console.error("Error loading select data:", error);
    }
  };

  const openFormDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
        relatedLeadId: task.leadId || "",
        relatedPropertyId: task.propertyId || "",
        assignedToId: task.assignedTo || "",
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "pending",
        dueDate: "",
        relatedLeadId: "",
        relatedPropertyId: "",
        assignedToId: "",
      });
    }
    setFormDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const taskData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority as "low" | "medium" | "high",
        status: formData.status as "pending" | "in_progress" | "completed",
        due_date: formData.dueDate || null,
        related_lead_id: formData.relatedLeadId || null,
        related_property_id: formData.relatedPropertyId || null,
        assigned_to_id: formData.assignedToId || null,
      };

      if (editingTask) {
        await handleUpdate(editingTask.id, taskData);
      } else {
        await handleCreate(taskData);
      }

      setFormDialogOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error("Error submitting task:", error);
    }
  };

  const openNotesDialog = (task: Task) => {
    setNotesTask(task);
    setNotes(task.notes || "");
    setNotesDialogOpen(true);
  };

  const handleNotesSubmit = async () => {
    if (!notesTask) return;

    try {
      await handleUpdate(notesTask.id, { notes });
      setNotesDialogOpen(false);
      setNotesTask(null);
      setNotes("");
      toast({
        title: "Notas atualizadas com sucesso!",
      });
    } catch (error) {
      console.error("Error updating notes:", error);
      toast({
        title: "Erro ao atualizar notas",
        variant: "destructive",
      });
    }
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie suas tarefas e acompanhe o progresso
          </p>
        </div>
        <Button onClick={() => openFormDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inProgress || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <CalendarClock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.overdue || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <TaskFilters
        filter={filter}
        onFilterChange={setFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {/* Tasks Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando tarefas...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <List className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">Nenhuma tarefa encontrada</CardTitle>
            <CardDescription>
              {searchTerm
                ? "Tente ajustar os filtros de pesquisa"
                : "Comece criando sua primeira tarefa"}
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onEdit={openFormDialog}
              onDelete={handleDelete}
              onAddNote={openNotesDialog}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <TaskDialogs
        formDialogOpen={formDialogOpen}
        onFormDialogOpenChange={setFormDialogOpen}
        editingTask={editingTask}
        formData={formData}
        onFormDataChange={handleFormDataChange}
        onSubmit={handleFormSubmit}
        submitting={submitting}
        notesDialogOpen={notesDialogOpen}
        onNotesDialogOpenChange={setNotesDialogOpen}
        notesTask={notesTask}
        notes={notes}
        onNotesChange={setNotes}
        onNotesSubmit={handleNotesSubmit}
        leads={leads}
        properties={properties}
        users={users}
      />
    </div>
  );
}