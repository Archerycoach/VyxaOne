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
      // Small delay to ensure Supabase processes the change
      await new Promise(resolve => setTimeout(resolve, 100));
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
      // Small delay to ensure Supabase processes the change
      await new Promise(resolve => setTimeout(resolve, 100));
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
    console.log("🔵 handleComplete called with id:", id);
    try {
      console.log("🔵 Calling completeTask...");
      await completeTask(id);
      console.log("✅ completeTask successful");
      toast({
        title: "Tarefa concluída",
        description: "A tarefa foi marcada como concluída",
      });
      console.log("🔵 Waiting 200ms before refetch...");
      // Increased delay to ensure Supabase processes the change
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log("🔵 Calling refetch...");
      refetch();
      console.log("✅ refetch called");
      return true;
    } catch (error) {
      console.error("❌ Error completing task:", error);
      toast({
        title: "Erro ao concluir tarefa",
        description: "Não foi possível concluir a tarefa",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    console.log("🔴 handleDelete called with id:", id);
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) {
      console.log("⚠️ Delete cancelled by user");
      return false;
    }

    console.log("🔴 Confirmed, calling deleteTask...");
    try {
      await deleteTask(id);
      console.log("✅ deleteTask successful");
      toast({
        title: "Tarefa excluída",
        description: "A tarefa foi excluída com sucesso",
      });
      console.log("🔴 Waiting 200ms before refetch...");
      // Increased delay to ensure Supabase processes the change
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log("🔴 Calling refetch...");
      refetch();
      console.log("✅ refetch called");
      return true;
    } catch (error) {
      console.error("❌ Error deleting task:", error);
      toast({
        title: "Erro ao excluir tarefa",
        description: "Não foi possível excluir a tarefa",
        variant: "destructive",
      });
      return false;
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