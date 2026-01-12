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
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Trash2, Edit, Mail, Phone } from "lucide-react";
import { getAllUsers, createUser, deleteUser, updateUserRole, getTeamLeads, assignAgentToTeamLead } from "@/services/adminService";
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
  const [selectedUser, setSelectedUser] = useState<any>(null); // Changed to any to support joined fields
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "agent" as "admin" | "team_lead" | "agent",
    teamLeadId: undefined as string | undefined,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResult, teamLeadsData] = await Promise.all([
          getAllUsers(),
          getTeamLeads()
        ]);
        
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
        fullName: newUser.full_name,
        phone: newUser.phone,
        role: newUser.role,
        isActive: true,
        teamLeadId: newUser.role === 'agent' ? newUser.teamLeadId : undefined,
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
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "agent",
        teamLeadId: undefined,
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

      // Refresh users list
      const usersResult = await getAllUsers();
      if (usersResult.data) {
        setUsers(usersResult.data);
        setFilteredUsers(usersResult.data);
      }
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

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      admin: "destructive",
      team_lead: "default",
      agent: "secondary",
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
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Utilizador
            </Button>
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
                          onClick={() => {
                            setSelectedUser(user);
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
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={newUser.full_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, full_name: e.target.value })
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
                    onValueChange={(value: any) =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newUser.role === 'agent' && (
                  <div>
                    <Label htmlFor="team-lead">Team Lead (Opcional)</Label>
                    <Select
                      value={newUser.teamLeadId || "none"}
                      onValueChange={(value) =>
                        setNewUser({ ...newUser, teamLeadId: value === "none" ? undefined : value })
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
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedUser?.role === 'agent' && (
                  <div>
                    <Label htmlFor="edit-team-lead">Team Lead</Label>
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
                  </div>
                )}
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