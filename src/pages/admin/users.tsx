import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Trash2, Edit, Mail, Phone, RefreshCw, MessageCircle, ShieldCheck, KeyRound } from "lucide-react";
import { getAllUsers, createUser, deleteUser, updateUserRole, getTeamLeads, assignAgentToTeamLead, toggleWhatsappModule, setUserSubscriptionExempt, setUserSubscriptionEnd } from "@/services/adminService";
import { getSubscriptionPlans, adminSetUserPlan, adminCancelUserSubscription, type SubscriptionPlan } from "@/services/subscriptionService";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  created_at: string;
  updated_at: string;
  whatsapp_module_enabled?: boolean;
}

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: "admin" | "team_lead" | "consultant";
  team_lead_id: string | null;
  is_active: boolean;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [teamLeads, setTeamLeads] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProcessingRelogin, setIsProcessingRelogin] = useState(false);
  const [accessEndDate, setAccessEndDate] = useState<string>("");
  const [savingAccess, setSavingAccess] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [manualPassword, setManualPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const { toast } = useToast();

  // Alteração manual da password do utilizador selecionado (só admin — o
  // endpoint /api/admin/update-password valida o papel pelo token de sessão).
  const handleUpdatePassword = async () => {
    if (!selectedUser?.id) return;
    if (manualPassword.length < 6) {
      toast({ title: "Password demasiado curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Inicie sessão novamente.");

      const response = await fetch("/api/admin/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: selectedUser.id, newPassword: manualPassword }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao alterar a password");

      setManualPassword("");
      toast({ title: "Password alterada", description: result.message });
    } catch (error: any) {
      toast({ title: "Erro ao alterar password", description: error.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const [newUser, setNewUser] = useState<NewUserForm>({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "consultant",
    team_lead_id: null,
    is_active: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResult, teamLeadsData, plansData] = await Promise.all([
          getAllUsers(),
          getTeamLeads(),
          getSubscriptionPlans().catch(() => [])
        ]);
        setPlans(plansData || []);
        
        if (usersResult.error) {
          console.error("Error fetching users:", usersResult.error);
          toast({
            title: "Erro",
            description: "Erro ao carregar utilizadores",
            variant: "destructive",
          });
        } else {
          const usersData = usersResult.data || [];
          setUsers(usersData);
          setFilteredUsers(usersData);
        }

        setTeamLeads(teamLeadsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleCreateUser = async () => {
    try {
      const result = await createUser({
        email: newUser.email,
        password: newUser.password,
        fullName: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        isActive: true,
        teamLeadId: newUser.role === 'consultant' ? newUser.team_lead_id : undefined,
      });
      
      if (result.error) {
        toast({
          title: "Erro",
          description: result.error.message || "Erro ao criar utilizador",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Utilizador criado com sucesso",
      });

      setIsCreateDialogOpen(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "consultant",
        team_lead_id: null,
        is_active: true,
      });

      // Refresh users list
      const usersResult = await getAllUsers();
      if (usersResult.data) {
        setUsers(usersResult.data);
        setFilteredUsers(usersResult.data);
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar utilizador",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const success = await deleteUser(selectedUser.id);
      
      if (!success) {
        toast({
          title: "Erro",
          description: "Erro ao eliminar utilizador",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Utilizador eliminado com sucesso",
      });

      setIsDeleteDialogOpen(false);
      setSelectedUser(null);

      // Refresh users list
      const usersResult = await getAllUsers();
      if (usersResult.data) {
        setUsers(usersResult.data);
        setFilteredUsers(usersResult.data);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro",
        description: "Erro ao eliminar utilizador",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedUser) return;

    try {
      const success = await updateUserRole(selectedUser.id, newRole);
      
      if (!success) {
        toast({
          title: "Erro",
          description: "Erro ao atualizar role",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Role atualizado com sucesso",
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);

      // Refresh users list e a lista de team-leads (um utilizador pode ter
      // acabado de ser promovido/despromovido a Team Lead).
      const [usersResult, teamLeadsData] = await Promise.all([
        getAllUsers(),
        getTeamLeads().catch(() => teamLeads),
      ]);
      if (usersResult.data) {
        setUsers(usersResult.data);
        setFilteredUsers(usersResult.data);
      }
      setTeamLeads(teamLeadsData || []);
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar role",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTeamLead = async (teamLeadId: string | null) => {
    if (!selectedUser) return;

    try {
      await assignAgentToTeamLead(selectedUser.id, teamLeadId === "none" ? null : teamLeadId);
      
      toast({
        title: "Sucesso",
        description: "Team Lead atualizado com sucesso",
      });

      // Refresh users list
      const usersResult = await getAllUsers();
      if (usersResult.data) {
        setUsers(usersResult.data);
        setFilteredUsers(usersResult.data);
        
        // Update selected user with new data
        const updatedUser = usersResult.data.find(u => u.id === selectedUser.id);
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
      }
    } catch (error: any) {
      console.error("Error updating team lead:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar Team Lead",
        variant: "destructive",
      });
    }
  };

  const refreshUsersAndSelected = async () => {
    const usersResult = await getAllUsers();
    if (usersResult.data) {
      setUsers(usersResult.data);
      setFilteredUsers(usersResult.data);
      const updated = usersResult.data.find((u) => u.id === selectedUser?.id);
      if (updated) setSelectedUser(updated);
    }
  };

  const handleToggleExempt = async (checked: boolean) => {
    if (!selectedUser) return;
    try {
      await setUserSubscriptionExempt(selectedUser.id, checked);
      toast({
        title: "Sucesso",
        description: checked ? "Utilizador isento de subscrição." : "Isenção removida.",
      });
      await refreshUsersAndSelected();
    } catch (error: any) {
      console.error("Error toggling exempt:", error);
      toast({ title: "Erro", description: error.message || "Não foi possível alterar a isenção.", variant: "destructive" });
    }
  };

  const handleSaveAccessEnd = async () => {
    if (!selectedUser) return;
    if (!accessEndDate) {
      toast({ title: "Indique uma data", variant: "destructive" });
      return;
    }
    setSavingAccess(true);
    try {
      const iso = new Date(`${accessEndDate}T23:59:59`).toISOString();
      await setUserSubscriptionEnd(selectedUser.id, iso);
      toast({ title: "Acesso atualizado", description: `Acesso válido até ${new Date(iso).toLocaleDateString("pt-PT")}.` });
      await refreshUsersAndSelected();
    } catch (error: any) {
      console.error("Error setting access end:", error);
      toast({ title: "Erro", description: error.message || "Não foi possível definir a data.", variant: "destructive" });
    } finally {
      setSavingAccess(false);
    }
  };

  const handleClearAccess = async () => {
    if (!selectedUser) return;
    setSavingAccess(true);
    try {
      await setUserSubscriptionEnd(selectedUser.id, null);
      setAccessEndDate("");
      toast({ title: "Acesso manual removido", description: "O utilizador volta a depender do trial/subscrição." });
      await refreshUsersAndSelected();
    } catch (error: any) {
      console.error("Error clearing access:", error);
      toast({ title: "Erro", description: error.message || "Não foi possível remover.", variant: "destructive" });
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSetPlan = async (value: string) => {
    if (!selectedUser) return;
    setSavingPlan(true);
    try {
      if (value === "none") {
        const ok = await adminCancelUserSubscription(selectedUser.id);
        if (!ok) throw new Error("Falha ao cancelar a subscrição");
        toast({ title: "Subscrição removida", description: "O utilizador ficou sem plano." });
      } else {
        // Se houver uma data de acesso definida no campo abaixo, usamo-la como fim.
        const endIso = accessEndDate ? new Date(`${accessEndDate}T23:59:59`).toISOString() : undefined;
        const ok = await adminSetUserPlan(selectedUser.id, value, endIso);
        if (!ok) throw new Error("Falha ao atribuir o plano");
        const planName = plans.find((p) => p.id === value)?.name || "plano";
        toast({ title: "Subscrição atualizada", description: `${planName} atribuído com subscrição ativa.` });
      }
      await refreshUsersAndSelected();
    } catch (error: any) {
      console.error("Error setting plan:", error);
      toast({ title: "Erro", description: error.message || "Não foi possível alterar a subscrição.", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleForceRelogin = async (userId?: string) => {
    setIsProcessingRelogin(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão inválida. Por favor, faça login novamente.");

      const response = await fetch("/api/admin/force-relogin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, all: !userId })
      });
      
      if (!response.ok) throw new Error("Erro ao forçar re-login");
      
      toast({
        title: "Sucesso",
        description: userId 
          ? "Pedido de re-login ativado para este utilizador." 
          : "Pedido de re-login geral ativado com sucesso.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o pedido.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingRelogin(false);
    }
  };

  const handleToggleWhatsapp = async (enabled: boolean) => {
    if (!selectedUser) return;
    try {
      await toggleWhatsappModule(selectedUser.id, enabled);
      toast({
        title: "Sucesso",
        description: enabled ? "Módulo WhatsApp ativado" : "Módulo WhatsApp desativado",
      });

      // Refresh locally
      const updatedUsers = users.map(u => u.id === selectedUser.id ? { ...u, whatsapp_module_enabled: enabled } : u);
      setUsers(updatedUsers);
      setFilteredUsers(filteredUsers.map(u => u.id === selectedUser.id ? { ...u, whatsapp_module_enabled: enabled } : u));
      setSelectedUser({ ...selectedUser, whatsapp_module_enabled: enabled });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar módulo WhatsApp",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      admin: "destructive",
      team_lead: "default",
      consultant: "secondary",
    };
    return <Badge variant={variants[role] || "secondary"}>{role}</Badge>;
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <p>A carregar utilizadores...</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Gestão de Utilizadores</h1>
              <p className="text-muted-foreground">
                Gerir utilizadores e permissões do sistema
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleForceRelogin()} disabled={isProcessingRelogin}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isProcessingRelogin ? "animate-spin" : ""}`} />
                Forçar Re-login Geral
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Novo Utilizador
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Procurar por nome, email ou role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {user.phone || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Forçar Re-login"
                          onClick={() => handleForceRelogin(user.id)}
                          disabled={isProcessingRelogin}
                        >
                          <RefreshCw className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setAccessEndDate(
                              (user as any).subscription_end_date
                                ? new Date((user as any).subscription_end_date).toISOString().slice(0, 10)
                                : ""
                            );
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Create User Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Utilizador</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo utilizador
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser({ ...newUser, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: "admin" | "team_lead" | "consultant") =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newUser.role === 'consultant' && (
                  <div>
                    <Label htmlFor="team-lead">Team Lead (Opcional)</Label>
                    <Select
                      value={newUser.team_lead_id || "none"}
                      onValueChange={(value) =>
                        setNewUser({ ...newUser, team_lead_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um Team Lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {teamLeads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.full_name || lead.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Role Dialog */}
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) setManualPassword("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Utilizador</DialogTitle>
                <DialogDescription>
                  Editar permissões e equipa de {selectedUser?.full_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    defaultValue={selectedUser?.role}
                    onValueChange={handleUpdateRole}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedUser && selectedUser.role !== 'admin' && selectedUser.role !== 'team_lead' && (
                  <div>
                    <Label htmlFor="edit-team-lead">Team Lead</Label>
                    {teamLeads.length === 0 ? (
                      <p className="text-sm text-muted-foreground border rounded-md p-3">
                        Ainda não há nenhum utilizador com o papel <strong>Team Lead</strong>. Para poder
                        atribuir um team-lead a este consultor, defina primeiro outro utilizador com o
                        role <strong>Team Lead</strong> (no campo Role, aqui ou noutro utilizador).
                      </p>
                    ) : (
                      <Select
                        value={selectedUser?.team_lead_id || "none"}
                        onValueChange={handleUpdateTeamLead}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um Team Lead" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {teamLeads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.full_name || lead.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border rounded-md p-4 mt-4 bg-slate-50">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-base flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      Módulo WhatsApp IA
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir que este utilizador aceda ao envio de templates e Agente IA via WhatsApp.
                    </p>
                  </div>
                  <Switch
                    checked={selectedUser?.whatsapp_module_enabled || false}
                    onCheckedChange={handleToggleWhatsapp}
                  />
                </div>

                <div className="border rounded-md p-4 space-y-3">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-amber-600" />
                      Alterar Password
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Define manualmente uma nova password para {selectedUser?.full_name || "este utilizador"}.
                      Comunique-a por um canal seguro e peça-lhe para a alterar depois de entrar.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Nova password (mín. 6 caracteres)"
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <Button
                      onClick={handleUpdatePassword}
                      disabled={savingPassword || manualPassword.length < 6}
                      className="shrink-0"
                    >
                      {savingPassword ? "A alterar..." : "Alterar"}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md p-4 space-y-4">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" />
                      Acesso / Subscrição
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {(selectedUser as any)?.trial_ends_at
                        ? `Fim do trial: ${new Date((selectedUser as any).trial_ends_at).toLocaleDateString("pt-PT")}. `
                        : ""}
                      {(selectedUser as any)?.subscription_end_date
                        ? `Acesso manual até: ${new Date((selectedUser as any).subscription_end_date).toLocaleDateString("pt-PT")}.`
                        : "Sem data de acesso manual definida."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user-plan">Plano de subscrição</Label>
                    <Select
                      value={(selectedUser as any)?.subscription_plan || "none"}
                      onValueChange={handleSetPlan}
                      disabled={savingPlan}
                    >
                      <SelectTrigger id="user-plan">
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem plano</SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{(p as any).ai_included ? " · IA integrada" : ""} — {p.price}€
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Atribui uma subscrição ativa com este plano (define também se o utilizador usa a IA integrada).
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <Label htmlFor="exempt-switch">Isento de subscrição</Label>
                      <p className="text-sm text-muted-foreground">
                        Acesso permanente, sem precisar de trial nem subscrição.
                      </p>
                    </div>
                    <Switch
                      id="exempt-switch"
                      checked={!!(selectedUser as any)?.subscription_exempt}
                      onCheckedChange={handleToggleExempt}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="access-end">Definir acesso válido até</Label>
                    <div className="flex gap-2">
                      <Input
                        id="access-end"
                        type="date"
                        value={accessEndDate}
                        onChange={(e) => setAccessEndDate(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleSaveAccessEnd} disabled={savingAccess}>
                        Aplicar
                      </Button>
                      {(selectedUser as any)?.subscription_end_date && (
                        <Button variant="outline" onClick={handleClearAccess} disabled={savingAccess}>
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marca a subscrição como ativa até à data escolhida. Para acesso sem prazo, use "Isento".
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete User Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar Utilizador</DialogTitle>
                <DialogDescription>
                  Tem a certeza que deseja eliminar o utilizador{" "}
                  {selectedUser?.full_name}? Esta ação não pode ser revertida.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteUser}>
                  Eliminar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}