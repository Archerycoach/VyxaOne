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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCombobox } from "@/components/ui/user-combobox";
import { Users, X } from "lucide-react";
import { getAllActiveUsersForLeadTransfer } from "@/services/profileService";
import { assignLead, shareLead, unshareLead, getLeadShares } from "@/services/leadsService";
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

  // Partilha
  const [shares, setShares] = useState<{ id: string; shared_with_user_id: string; full_name: string | null; email: string | null }[]>([]);
  const [selectedShareUserId, setSelectedShareUserId] = useState<string>("");
  const [isSharing, setIsSharing] = useState(false);
  const [removingShareId, setRemovingShareId] = useState<string | null>(null);

  // Confirmação antes de executar — evita transferências/partilhas por
  // clique acidental. Guarda a ação pendente; null = nenhum pedido aberto.
  const [confirmAction, setConfirmAction] = useState<"transfer" | "share" | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadShares();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const fetchedUsers = await getAllActiveUsersForLeadTransfer();
      setUsers(fetchedUsers as any);

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

  const loadShares = async () => {
    try {
      const fetchedShares = await getLeadShares(leadId);
      setShares(fetchedShares);
    } catch (error: any) {
      console.error("Error loading lead shares:", error);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast({
        title: "Selecione um utilizador",
        description: "Por favor selecione um utilizador para transferir esta lead.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await assignLead(leadId, selectedUserId);

      const assignedUser = users.find(u => u.id === selectedUserId);

      toast({
        title: "Lead transferida com sucesso!",
        description: `Lead "${leadName}" foi transferida para ${assignedUser?.full_name || assignedUser?.email}.`,
      });

      setIsOpen(false);
      onAssignSuccess?.();
    } catch (error: any) {
      console.error("Error assigning lead:", error);
      toast({
        title: "Erro ao transferir lead",
        description: error.message || "Não foi possível transferir a lead.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedShareUserId) {
      toast({
        title: "Selecione um utilizador",
        description: "Por favor selecione um utilizador para partilhar esta lead.",
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    try {
      await shareLead(leadId, selectedShareUserId);
      toast({ title: "Lead partilhada com sucesso!" });
      setSelectedShareUserId("");
      await loadShares();
      onAssignSuccess?.();
    } catch (error: any) {
      console.error("Error sharing lead:", error);
      toast({
        title: "Erro ao partilhar lead",
        description: error.message || "Não foi possível partilhar a lead.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async (userId: string, shareId: string) => {
    setRemovingShareId(shareId);
    try {
      await unshareLead(leadId, userId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast({ title: "Partilha removida" });
      onAssignSuccess?.();
    } catch (error: any) {
      console.error("Error removing share:", error);
      toast({
        title: "Erro ao remover partilha",
        description: error.message || "Não foi possível remover a partilha.",
        variant: "destructive",
      });
    } finally {
      setRemovingShareId(null);
    }
  };

  const shareableUsers = users.filter((u) => !shares.some((s) => s.shared_with_user_id === u.id));

  const confirmTargetUser = users.find(
    (u) => u.id === (confirmAction === "transfer" ? selectedUserId : selectedShareUserId)
  );
  const confirmTargetName = confirmTargetUser?.full_name || confirmTargetUser?.email || "";

  const handleConfirm = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "transfer") {
      await handleAssign();
    } else if (action === "share") {
      await handleShare();
    }
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
          <DialogTitle>Gerir Lead &quot;{leadName}&quot;</DialogTitle>
          <DialogDescription>
            Transfira a lead para outro utilizador, ou partilhe-a mantendo o seu acesso atual.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="transfer">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transfer">Transferir</TabsTrigger>
            <TabsTrigger value="share">Partilhar</TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Utilizador
              </label>
              <UserCombobox
                users={users}
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder="Selecione um utilizador"
                emptyText="Nenhum utilizador disponível"
              />
            </div>
            <Button onClick={() => setConfirmAction("transfer")} disabled={isLoading || !selectedUserId} className="w-full">
              {isLoading ? "A transferir..." : "Transferir"}
            </Button>
          </TabsContent>

          <TabsContent value="share" className="space-y-4 py-2">
            {shares.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Partilhada com</p>
                <div className="space-y-1">
                  {shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{share.full_name || share.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={removingShareId === share.id}
                        onClick={() => handleUnshare(share.shared_with_user_id, share.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Partilhar com
              </label>
              <UserCombobox
                users={shareableUsers}
                value={selectedShareUserId}
                onChange={setSelectedShareUserId}
                placeholder="Selecione um utilizador"
                emptyText="Nenhum utilizador disponível"
              />
            </div>
            <Button onClick={() => setConfirmAction("share")} disabled={isSharing || !selectedShareUserId} className="w-full">
              {isSharing ? "A partilhar..." : "Partilhar"}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>

        <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === "transfer" ? "Confirmar transferência" : "Confirmar partilha"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === "transfer"
                  ? `A lead "${leadName}" vai ser transferida para ${confirmTargetName}. A lead passa a estar atribuída a essa pessoa.`
                  : `A lead "${leadName}" vai ser partilhada com ${confirmTargetName}. Essa pessoa passa a poder ver e editar a lead, sem alterar a atribuição atual.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>
                {confirmAction === "transfer" ? "Transferir" : "Partilhar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
