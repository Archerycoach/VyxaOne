import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  createTask,
  updateTask,
  completeTask,
  deleteTask,
} from "@/services/tasksService";

export function useTaskMutations(refetch: () => void) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleCreate = async (taskData: any) => {
    try {
      setSubmitting(true);
      await createTask(taskData);
      toast({
        title: "Tarefa criada",
        description: "A tarefa foi criada com sucesso",
      });
      refetch();
      return true;
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Erro ao criar tarefa",
        description: "Não foi possível criar a tarefa",
        variant: "destructive",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, taskData: any) => {
    try {
      setSubmitting(true);
      await updateTask(id, taskData);
      toast({
        title: "Tarefa atualizada",
        description: "A tarefa foi atualizada com sucesso",
      });
      refetch();
      return true;
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Erro ao atualizar tarefa",
        description: "Não foi possível atualizar a tarefa",
        variant: "destructive",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeTask(id);
      toast({
        title: "Tarefa concluída",
        description: "A tarefa foi marcada como concluída",
      });
      refetch();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Erro ao concluir tarefa",
        description: "Não foi possível concluir a tarefa",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;

    try {
      await deleteTask(id);
      toast({
        title: "Tarefa excluída",
        description: "A tarefa foi excluída com sucesso",
      });
      refetch();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Erro ao excluir tarefa",
        description: "Não foi possível excluir a tarefa",
        variant: "destructive",
      });
    }
  };

  return {
    submitting,
    handleCreate,
    handleUpdate,
    handleComplete,
    handleDelete,
  };
}