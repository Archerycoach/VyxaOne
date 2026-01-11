import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getSecuritySettings, updateSecuritySettings } from "@/services/settingsService";
import { getAllUsers, updateUserRole } from "@/services/adminService";
import { getSession } from "@/services/authService";
import { getUserProfile } from "@/services/profileService";

const ROLES = [
  { value: "admin", label: "Administrador", color: "bg-red-100 text-red-700" },
  { value: "manager", label: "Gestor", color: "bg-blue-100 text-blue-700" },
  { value: "agent", label: "Agente", color: "bg-green-100 text-green-700" },
  { value: "viewer", label: "Visualizador", color: "bg-slate-100 text-slate-700" },
];

const PERMISSIONS = {
  admin: {
    leads: { view: true, create: true, edit: true, delete: true },
    properties: { view: true, create: true, edit: true, delete: true },
    tasks: { view: true, create: true, edit: true, delete: true },
    calendar: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: true },
    users: { view: true, create: true, edit: true, delete: true },
  },
  manager: {
    leads: { view: true, create: true, edit: true, delete: true },
    properties: { view: true, create: true, edit: true, delete: false },
    tasks: { view: true, create: true, edit: true, delete: true },
    calendar: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: false },
    users: { view: true, create: false, edit: false, delete: false },
  },
  agent: {
    leads: { view: true, create: true, edit: true, delete: false },
    properties: { view: true, create: false, edit: false, delete: false },
    tasks: { view: true, create: true, edit: true, delete: false },
    calendar: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: false },
    settings: { view: false, edit: false },
    users: { view: false, create: false, edit: false, delete: false },
  },
  viewer: {
    leads: { view: true, create: false, edit: false, delete: false },
    properties: { view: true, create: false, edit: false, delete: false },
    tasks: { view: true, create: false, edit: false, delete: false },
    calendar: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: false },
    settings: { view: false, edit: false },
    users: { view: false, create: false, edit: false, delete: false },
  },
};

export default function SecuritySettings() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const [securitySettings, setSecuritySettings] = useState({
    require_2fa: false,
    session_timeout: 3600,
    password_min_length: 8,
    max_login_attempts: 5,
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const profile = await getUserProfile();
      if (profile?.role !== "admin") {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem aceder a esta página.",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }

      await loadData();
    } catch (error) {
      console.error("Error checking access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [settings, usersResult] = await Promise.all([
        getSecuritySettings(),
        getAllUsers(),
      ]);

      setSecuritySettings(settings as any);
      
      if (usersResult.error) {
        console.error("Error loading users:", usersResult.error);
      } else {
        setUsers(usersResult.data || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      });
    }
  };

  const handleSaveSecuritySettings = async () => {
    setSaving(true);
    try {
      await updateSecuritySettings(securitySettings);
      toast({
        title: "Sucesso",
        description: "Definições de segurança atualizadas com sucesso",
      });
    } catch (error) {
      console.error("Error saving security settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao guardar definições de segurança",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: "Sucesso",
        description: "Role do utilizador atualizado com sucesso",
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar role do utilizador",
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  const getRoleColor = (role: string) => {
    return ROLES.find(r => r.value === role)?.color || "bg-slate-100 text-slate-700";
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/admin/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                🔒 Segurança e Permissões
              </h1>
              <p className="text-slate-600 mt-2">
                Gerir roles de utilizadores e definições de segurança
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  👥 Gestão de Roles
                </CardTitle>
                <CardDescription>
                  Atribuir roles e permissões aos utilizadores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilizador</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role Atual</TableHead>
                      <TableHead>Alterar Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || "Sem nome"}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(user.role || "viewer")}>
                            {getRoleLabel(user.role || "viewer")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role || "viewer"}
                            onValueChange={(value) => handleChangeUserRole(user.id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🎯 Matriz de Permissões
                </CardTitle>
                <CardDescription>
                  Permissões por role (apenas visualização)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Módulo</th>
                        <th className="text-center p-3 font-semibold text-red-700">
                          Admin
                        </th>
                        <th className="text-center p-3 font-semibold text-blue-700">
                          Manager
                        </th>
                        <th className="text-center p-3 font-semibold text-green-700">
                          Agent
                        </th>
                        <th className="text-center p-3 font-semibold text-slate-700">
                          Viewer
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(PERMISSIONS.admin).map((module) => (
                        <tr key={module} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium capitalize">{module}</td>
                          {ROLES.map((role) => {
                            const perms = PERMISSIONS[role.value as keyof typeof PERMISSIONS][module as keyof typeof PERMISSIONS.admin] as any;
                            return (
                              <td key={role.value} className="p-3 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {perms.view !== undefined && perms.view && (
                                    <Badge variant="outline" className="text-xs">
                                      Ver
                                    </Badge>
                                  )}
                                  {perms.create !== undefined && perms.create && (
                                    <Badge variant="outline" className="text-xs">
                                      Criar
                                    </Badge>
                                  )}
                                  {perms.edit !== undefined && perms.edit && (
                                    <Badge variant="outline" className="text-xs">
                                      Editar
                                    </Badge>
                                  )}
                                  {perms.delete !== undefined && perms.delete && (
                                    <Badge variant="outline" className="text-xs">
                                      Apagar
                                    </Badge>
                                  )}
                                  {perms.export !== undefined && perms.export && (
                                    <Badge variant="outline" className="text-xs">
                                      Exportar
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-blue-900">
                    ℹ️ <strong>Nota:</strong> As permissões são aplicadas automaticamente
                    com base no role do utilizador. A personalização granular de
                    permissões estará disponível em breve.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🛡️ Definições de Segurança
                </CardTitle>
                <CardDescription>
                  Configurar políticas de segurança da aplicação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="require-2fa">
                        Autenticação de Dois Fatores (2FA)
                      </Label>
                      <p className="text-sm text-slate-500">
                        Obrigar todos os utilizadores a usar 2FA
                      </p>
                    </div>
                    <Switch
                      id="require-2fa"
                      checked={securitySettings.require_2fa}
                      onCheckedChange={(checked) =>
                        setSecuritySettings({ ...securitySettings, require_2fa: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">
                      Timeout de Sessão (segundos)
                    </Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={securitySettings.session_timeout}
                      onChange={(e) =>
                        setSecuritySettings({
                          ...securitySettings,
                          session_timeout: parseInt(e.target.value) || 3600,
                        })
                      }
                    />
                    <p className="text-sm text-slate-500">
                      Tempo até o utilizador ser desconectado por inatividade
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="password-length">
                      Comprimento Mínimo da Palavra-passe
                    </Label>
                    <Input
                      id="password-length"
                      type="number"
                      value={securitySettings.password_min_length}
                      onChange={(e) =>
                        setSecuritySettings({
                          ...securitySettings,
                          password_min_length: parseInt(e.target.value) || 8,
                        })
                      }
                    />
                    <p className="text-sm text-slate-500">
                      Número mínimo de caracteres para palavras-passe
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="max-attempts">
                      Máximo de Tentativas de Login
                    </Label>
                    <Input
                      id="max-attempts"
                      type="number"
                      value={securitySettings.max_login_attempts}
                      onChange={(e) =>
                        setSecuritySettings({
                          ...securitySettings,
                          max_login_attempts: parseInt(e.target.value) || 5,
                        })
                      }
                    />
                    <p className="text-sm text-slate-500">
                      Número de tentativas antes de bloquear temporariamente
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveSecuritySettings} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          A guardar...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Definições
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}