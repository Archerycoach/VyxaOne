import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Shield, Award, User, Mail, Calendar, TrendingUp, Edit2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  manager_id: string | null;
  manager_name: string | null;
  total_leads: number;
  active_leads: number;
  last_login: string | null;
  created_at: string;
}

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviting, setInviting] = useState(false);

  // Edit dialog
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editManager, setEditManager] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        router.push("/login");
        return;
      }

      // Get user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = profile?.role;
      setCurrentUserRole(role || null);

      // Only broker, admin, and team_lead can access this page
      if (role !== "broker" && role !== "admin" && role !== "team_lead") {
        router.push("/dashboard");
        return;
      }

      await loadTeamMembers();
      setLoading(false);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      router.push("/login");
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase.rpc("get_team_overview" as any);

      if (error) {
        console.error("Error loading team:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a equipa.",
          variant: "destructive"
        });
        return;
      }

      setTeamMembers((data as any[]) || []);
    } catch (error) {
      console.error("Error in loadTeamMembers:", error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteFullName) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor preencha email e nome completo.",
        variant: "destructive"
      });
      return;
    }

    setInviting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteFullName
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to invite user");
      }

      toast({
        title: "Utilizador convidado!",
        description: result.message
      });

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteFullName("");
      await loadTeamMembers();

    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast({
        title: "Erro ao convidar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setInviting(false);
    }
  };

  const handleEditUser = (member: TeamMember) => {
    setEditingUser(member);
    setEditRole(member.role);
    setEditManager(member.manager_id || "");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // Update role if changed
      if (editRole !== editingUser.role) {
        const response = await fetch("/api/team/update-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            target_user_id: editingUser.user_id,
            new_role: editRole
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to update role");
        }
      }

      // Update manager if consultant and manager changed
      if (editRole === "consultant" && editManager !== (editingUser.manager_id || "")) {
        const response = await fetch("/api/team/assign-manager", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            consultant_id: editingUser.user_id,
            manager_id: editManager || null
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to assign manager");
        }
      }

      toast({
        title: "Atualizado com sucesso!",
        description: "As alterações foram guardadas."
      });

      setEditingUser(null);
      await loadTeamMembers();

    } catch (error: any) {
      console.error("Error saving changes:", error);
      toast({
        title: "Erro ao guardar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "broker": return "Broker";
      case "team_lead": return "Team Lead";
      case "consultant": return "Consultor";
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800 border-red-200";
      case "broker": return "bg-purple-100 text-purple-800 border-purple-200";
      case "team_lead": return "bg-blue-100 text-blue-800 border-blue-200";
      case "consultant": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // Group by team lead for better visualization
  const groupedTeam = () => {
    const groups: Record<string, TeamMember[]> = {
      "admin_broker": [],
      "team_leads": [],
      "unassigned": []
    };

    teamMembers.forEach(member => {
      if (member.role === "admin" || member.role === "broker") {
        groups["admin_broker"].push(member);
      } else if (member.role === "team_lead") {
        groups["team_leads"].push(member);
        // Initialize array for this team lead's consultants
        groups[member.user_id] = [];
      }
    });

    // Assign consultants to their team leads
    teamMembers.forEach(member => {
      if (member.role === "consultant") {
        if (member.manager_id && groups[member.manager_id]) {
          groups[member.manager_id].push(member);
        } else {
          groups["unassigned"].push(member);
        }
      }
    });

    return groups;
  };

  const teamLeads = teamMembers.filter(m => m.role === "team_lead");

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full min-h-[600px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">A carregar equipa...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const canEdit = currentUserRole === "broker" || currentUserRole === "admin";
  const groups = groupedTeam();

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Equipa</h1>
            <p className="text-muted-foreground">
              {canEdit ? "Gerir utilizadores, papéis e equipas" : "Visualizar a sua equipa"}
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Utilizador
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Membros</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamMembers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Leads</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamMembers.filter(m => m.role === "team_lead").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consultores</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamMembers.filter(m => m.role === "consultant").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads Ativas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamMembers.reduce((sum, m) => sum + (m.active_leads || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin/Broker Section */}
        {groups["admin_broker"].length > 0 && canEdit && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                Administração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Último Login</TableHead>
                    {canEdit && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups["admin_broker"].map(member => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {getRoleLabel(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{member.active_leads} ativas</span>
                          <span className="text-xs text-muted-foreground">{member.total_leads} total</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(member.last_login)}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(member)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Team Leads and Their Consultants */}
        {groups["team_leads"].map(teamLead => (
          <Card key={teamLead.user_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600" />
                  {teamLead.full_name}
                  <Badge className={getRoleBadgeColor("team_lead")}>
                    Team Lead
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{groups[teamLead.user_id]?.length || 0} consultores</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditUser(teamLead)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {teamLead.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    {teamLead.active_leads} leads ativas
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(teamLead.last_login)}
                  </span>
                </div>
              </CardDescription>
            </CardHeader>
            {groups[teamLead.user_id]?.length > 0 && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Leads Ativas</TableHead>
                      <TableHead>Total Leads</TableHead>
                      <TableHead>Último Login</TableHead>
                      {canEdit && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups[teamLead.user_id].map(consultant => (
                      <TableRow key={consultant.user_id}>
                        <TableCell className="font-medium">{consultant.full_name}</TableCell>
                        <TableCell>{consultant.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {consultant.active_leads}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {consultant.total_leads}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(consultant.last_login)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(consultant)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        ))}

        {/* Unassigned Consultants */}
        {groups["unassigned"].length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-amber-600" />
                Consultores Sem Equipa
              </CardTitle>
              <CardDescription>
                Estes consultores ainda não foram atribuídos a um Team Lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Leads Ativas</TableHead>
                    <TableHead>Total Leads</TableHead>
                    <TableHead>Último Login</TableHead>
                    {canEdit && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups["unassigned"].map(member => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {member.active_leads}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.total_leads}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(member.last_login)}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(member)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Novo Utilizador</DialogTitle>
            <DialogDescription>
              O utilizador receberá um email para definir a sua palavra-passe e será criado como Consultor por defeito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="João Silva"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="joao@exemplo.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={inviting}
            >
              Cancelar
            </Button>
            <Button onClick={handleInviteUser} disabled={inviting}>
              {inviting ? "A enviar..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Utilizador</DialogTitle>
            <DialogDescription>
              {editingUser?.full_name} ({editingUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role">Papel</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  <SelectItem value="consultant">Consultor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === "consultant" && (
              <div>
                <Label htmlFor="manager">Team Lead (opcional)</Label>
                <Select value={editManager} onValueChange={setEditManager}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem equipa atribuída" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem equipa atribuída</SelectItem>
                    {teamLeads.map(tl => (
                      <SelectItem key={tl.user_id} value={tl.user_id}>
                        {tl.full_name}
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
              onClick={() => setEditingUser(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}