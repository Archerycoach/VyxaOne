import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { getUsersForAssignment } from "@/services/profileService";
import { assignLead } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";

interface AssignLeadDialogProps {
  leadId: string;
  leadName: string;
  currentAssignedUserId?: string | null;
  onAssignSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export function AssignLeadDialog({
  leadId,
  leadName,
  currentAssignedUserId,
  onAssignSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AssignLeadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const fetchedUsers = await getUsersForAssignment();
      setUsers(fetchedUsers);
      
      // Pre-select current assigned user if exists
      if (currentAssignedUserId) {
        setSelectedUserId(currentAssignedUserId);
      }
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast({
        title: "Erro ao carregar utilizadores",
        description: error.message || "Não foi possível carregar a lista de utilizadores.",
        variant: "destructive",
      });
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast({
        title: "Selecione um utilizador",
        description: "Por favor selecione um utilizador para atribuir esta lead.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await assignLead(leadId, selectedUserId);
      
      const assignedUser = users.find(u => u.id === selectedUserId);
      
      toast({
        title: "Lead atribuída com sucesso!",
        description: `Lead "${leadName}" foi atribuída a ${assignedUser?.full_name || assignedUser?.email}.`,
      });

      setIsOpen(false);
      onAssignSuccess?.();
    } catch (error: any) {
      console.error("Error assigning lead:", error);
      toast({
        title: "Erro ao atribuir lead",
        description: error.message || "Não foi possível atribuir a lead.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: "Admin",
      team_lead: "Team Lead",
      agent: "Agente",
    };
    return roleLabels[role] || role;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
          >
            <Users className="h-4 w-4 mr-1" />
            <span className="text-xs">Atribuir Agente</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atribuir Lead</DialogTitle>
          <DialogDescription>
            Selecione um utilizador para atribuir a lead &quot;{leadName}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label htmlFor="user-select" className="text-sm font-medium">
              Utilizador
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select">
                <SelectValue placeholder="Selecione um utilizador" />
              </SelectTrigger>
              <SelectContent>
                {users.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">
                    Nenhum utilizador disponível
                  </div>
                ) : (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.full_name || user.email}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({getRoleBadge(user.role)})
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {user.email}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={isLoading || !selectedUserId}>
            {isLoading ? "A atribuir..." : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}