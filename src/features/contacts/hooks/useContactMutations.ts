import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  createContact,
  updateContact,
  deleteContact,
  configureAutoMessages,
} from "@/services/contactsService";

export function useContactMutations(onSuccess?: () => void) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleCreate = async (data: any) => {
    try {
      setSubmitting(true);
      await createContact(data);
      toast({
        title: "Contacto criado!",
        description: "O contacto foi criado com sucesso.",
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating contact:", error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao criar o contacto.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      setSubmitting(true);
      await updateContact(id, data);
      toast({
        title: "Contacto atualizado!",
        description: "O contacto foi atualizado com sucesso.",
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Error updating contact:", error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao atualizar o contacto.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja eliminar este contacto?")) return;

    try {
      await deleteContact(id);
      toast({
        title: "Contacto eliminado",
        description: "O contacto foi eliminado com sucesso.",
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao eliminar o contacto.",
        variant: "destructive",
      });
    }
  };

  const handleConfigureAutoMessages = async (id: string, config: any) => {
    try {
      await configureAutoMessages(id, config);
      toast({
        title: "Configuração guardada!",
        description: "As mensagens automáticas foram configuradas.",
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Error configuring auto messages:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao guardar a configuração.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    submitting,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleConfigureAutoMessages,
  };
}