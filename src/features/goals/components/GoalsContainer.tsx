import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Users, User, Save, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Define interface manually since auto-generated types might lag behind
interface Goal {
  id: string;
  user_id: string | null;
  goal_type: "team" | "individual";
  period: "annual" | "semester";
  year: number;
  semester: number | null;
  revenue_target: number | null;
  acquisitions_target: number | null;
  created_at?: string;
}

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
}

export function GoalsContainer() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentSemester = currentMonth <= 6 ? 1 : 2;

  // Team Goals
  const [teamAnnualRevenue, setTeamAnnualRevenue] = useState("");
  const [teamAnnualAcquisitions, setTeamAnnualAcquisitions] = useState("");
  const [teamS1Revenue, setTeamS1Revenue] = useState("");
  const [teamS1Acquisitions, setTeamS1Acquisitions] = useState("");
  const [teamS2Revenue, setTeamS2Revenue] = useState("");
  const [teamS2Acquisitions, setTeamS2Acquisitions] = useState("");

  // Individual Goals (for selected agent or current user)
  const [individualAnnualRevenue, setIndividualAnnualRevenue] = useState("");
  const [individualAnnualAcquisitions, setIndividualAnnualAcquisitions] = useState("");
  const [individualS1Revenue, setIndividualS1Revenue] = useState("");
  const [individualS1Acquisitions, setIndividualS1Acquisitions] = useState("");
  const [individualS2Revenue, setIndividualS2Revenue] = useState("");
  const [individualS2Acquisitions, setIndividualS2Acquisitions] = useState("");

  const isAdmin = userRole === "admin";
  const isTeamLead = userRole === "team_lead";
  const isAdminOrTeamLead = isAdmin || isTeamLead;

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (selectedAgent && isAdminOrTeamLead) {
      loadAgentGoals(selectedAgent);
    }
  }, [selectedAgent]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role || null;
      setUserRole(role);
      setUserId(user.id);

      // Load team members for team leads and admins
      if (role === "admin" || role === "team_lead") {
        await loadTeamMembers(user.id, role);
      }

      await loadGoals(user.id, role);
    } catch (error) {
      console.error("Error loading user data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do utilizador",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async (uid: string, role: string) => {
    try {
      let query = supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("is_active", true);

      if (role === "team_lead") {
        // Team leads see only their agents
        query = query.eq("team_lead_id", uid).eq("role", "agent");
      } else if (role === "admin") {
        // Admins see all agents and team leads
        query = query.in("role", ["agent", "team_lead"]);
      }

      const { data, error } = await query.order("full_name");

      if (error) throw error;

      setTeamMembers(data || []);
    } catch (error) {
      console.error("Error loading team members:", error);
    }
  };

  const loadGoals = async (uid: string, role: string | null) => {
    try {
      // Using "as any" to bypass type checking for the new table
      const { data: goalsData, error } = await supabase
        .from("goals" as any)
        .select("*")
        .eq("year", currentYear);

      if (error) throw error;
      
      const goals = goalsData as unknown as Goal[];

      // Load team goals for admins and team leads
      if (role === "admin" || role === "team_lead") {
        goals?.forEach((goal: Goal) => {
          if (goal.goal_type === "team") {
            const revenueValue = goal.revenue_target?.toString() || "";
            const acquisitionsValue = goal.acquisitions_target?.toString() || "";

            if (goal.period === "annual") {
              setTeamAnnualRevenue(revenueValue);
              setTeamAnnualAcquisitions(acquisitionsValue);
            } else if (goal.semester === 1) {
              setTeamS1Revenue(revenueValue);
              setTeamS1Acquisitions(acquisitionsValue);
            } else if (goal.semester === 2) {
              setTeamS2Revenue(revenueValue);
              setTeamS2Acquisitions(acquisitionsValue);
            }
          }
        });
      }

      // Load individual goals for current user (agents or own goals)
      goals?.forEach((goal: Goal) => {
        if (goal.goal_type === "individual" && goal.user_id === uid) {
          const revenueValue = goal.revenue_target?.toString() || "";
          const acquisitionsValue = goal.acquisitions_target?.toString() || "";

          if (goal.period === "annual") {
            setIndividualAnnualRevenue(revenueValue);
            setIndividualAnnualAcquisitions(acquisitionsValue);
          } else if (goal.semester === 1) {
            setIndividualS1Revenue(revenueValue);
            setIndividualS1Acquisitions(acquisitionsValue);
          } else if (goal.semester === 2) {
            setIndividualS2Revenue(revenueValue);
            setIndividualS2Acquisitions(acquisitionsValue);
          }
        }
      });
    } catch (error) {
      console.error("Error loading goals:", error);
    }
  };

  const loadAgentGoals = async (agentId: string) => {
    try {
      const { data: goalsData, error } = await supabase
        .from("goals" as any)
        .select("*")
        .eq("year", currentYear)
        .eq("goal_type", "individual")
        .eq("user_id", agentId);

      if (error) throw error;

      const goals = goalsData as unknown as Goal[];

      // Reset individual goals
      setIndividualAnnualRevenue("");
      setIndividualAnnualAcquisitions("");
      setIndividualS1Revenue("");
      setIndividualS1Acquisitions("");
      setIndividualS2Revenue("");
      setIndividualS2Acquisitions("");

      goals?.forEach((goal: Goal) => {
        const revenueValue = goal.revenue_target?.toString() || "";
        const acquisitionsValue = goal.acquisitions_target?.toString() || "";

        if (goal.period === "annual") {
          setIndividualAnnualRevenue(revenueValue);
          setIndividualAnnualAcquisitions(acquisitionsValue);
        } else if (goal.semester === 1) {
          setIndividualS1Revenue(revenueValue);
          setIndividualS1Acquisitions(acquisitionsValue);
        } else if (goal.semester === 2) {
          setIndividualS2Revenue(revenueValue);
          setIndividualS2Acquisitions(acquisitionsValue);
        }
      });
    } catch (error) {
      console.error("Error loading agent goals:", error);
    }
  };

  const saveGoal = async (
    goalType: "team" | "individual",
    period: "annual" | "semester",
    semester: number | null,
    revenue: string,
    acquisitions: string,
    targetUserId?: string
  ) => {
    const goalData = {
      user_id: goalType === "individual" ? (targetUserId || userId) : null,
      goal_type: goalType,
      period,
      year: currentYear,
      semester,
      revenue_target: revenue ? parseFloat(revenue) : null,
      acquisitions_target: acquisitions ? parseInt(acquisitions) : null,
      created_by: userId,
    };

    // Using "as any" to bypass type checking for the new table
    const { error } = await supabase
      .from("goals" as any)
      .upsert(goalData, {
        onConflict: "user_id,goal_type,period,year,semester",
      });

    if (error) throw error;
  };

  const handleSaveTeamGoals = async () => {
    if (!isAdminOrTeamLead) return;

    try {
      setSaving(true);

      // Save annual team goal
      await saveGoal("team", "annual", null, teamAnnualRevenue, teamAnnualAcquisitions);

      // Save semester 1 team goal
      await saveGoal("team", "semester", 1, teamS1Revenue, teamS1Acquisitions);

      // Save semester 2 team goal
      await saveGoal("team", "semester", 2, teamS2Revenue, teamS2Acquisitions);

      toast({
        title: "Sucesso",
        description: "Objetivos da equipa guardados com sucesso",
      });
    } catch (error) {
      console.error("Error saving team goals:", error);
      toast({
        title: "Erro",
        description: "Erro ao guardar objetivos da equipa",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIndividualGoals = async () => {
    try {
      setSaving(true);

      const targetUserId = isAdminOrTeamLead && selectedAgent ? selectedAgent : userId;

      // Save annual individual goal
      await saveGoal("individual", "annual", null, individualAnnualRevenue, individualAnnualAcquisitions, targetUserId);

      // Save semester 1 individual goal
      await saveGoal("individual", "semester", 1, individualS1Revenue, individualS1Acquisitions, targetUserId);

      // Save semester 2 individual goal
      await saveGoal("individual", "semester", 2, individualS2Revenue, individualS2Acquisitions, targetUserId);

      const message = isAdminOrTeamLead && selectedAgent 
        ? "Objetivos do agente guardados com sucesso"
        : "Objetivos pessoais guardados com sucesso";

      toast({
        title: "Sucesso",
        description: message,
      });
    } catch (error) {
      console.error("Error saving individual goals:", error);
      toast({
        title: "Erro",
        description: "Erro ao guardar objetivos",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">A carregar objetivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Target className="h-8 w-8 text-blue-600" />
            Objetivos {currentYear}
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure as metas de faturação e angariações
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Semestre Atual: {currentSemester}</span>
        </div>
      </div>

      <Tabs defaultValue="team" className="space-y-6">
        <TabsList>
          {isAdminOrTeamLead && (
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Objetivos da Equipa
            </TabsTrigger>
          )}
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {isAdminOrTeamLead ? "Objetivos dos Agentes" : "Objetivos Pessoais"}
          </TabsTrigger>
        </TabsList>

        {/* Team Goals Tab */}
        {isAdminOrTeamLead && (
          <TabsContent value="team" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Metas Anuais da Equipa
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Objetivos para todo o ano {currentYear}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="team-annual-revenue">Faturação Anual (€)</Label>
                  <Input
                    id="team-annual-revenue"
                    type="number"
                    placeholder="Ex: 500000"
                    value={teamAnnualRevenue}
                    onChange={(e) => setTeamAnnualRevenue(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="team-annual-acquisitions">Número de Angariações</Label>
                  <Input
                    id="team-annual-acquisitions"
                    type="number"
                    placeholder="Ex: 50"
                    value={teamAnnualAcquisitions}
                    onChange={(e) => setTeamAnnualAcquisitions(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Semester 1 */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">1º Semestre</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="team-s1-revenue">Faturação (€)</Label>
                    <Input
                      id="team-s1-revenue"
                      type="number"
                      placeholder="Ex: 250000"
                      value={teamS1Revenue}
                      onChange={(e) => setTeamS1Revenue(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="team-s1-acquisitions">Angariações</Label>
                    <Input
                      id="team-s1-acquisitions"
                      type="number"
                      placeholder="Ex: 25"
                      value={teamS1Acquisitions}
                      onChange={(e) => setTeamS1Acquisitions(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </Card>

              {/* Semester 2 */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">2º Semestre</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="team-s2-revenue">Faturação (€)</Label>
                    <Input
                      id="team-s2-revenue"
                      type="number"
                      placeholder="Ex: 250000"
                      value={teamS2Revenue}
                      onChange={(e) => setTeamS2Revenue(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="team-s2-acquisitions">Angariações</Label>
                    <Input
                      id="team-s2-acquisitions"
                      type="number"
                      placeholder="Ex: 25"
                      value={teamS2Acquisitions}
                      onChange={(e) => setTeamS2Acquisitions(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveTeamGoals}
                disabled={saving}
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "A guardar..." : "Guardar Objetivos da Equipa"}
              </Button>
            </div>
          </TabsContent>
        )}

        {/* Individual Goals Tab */}
        <TabsContent value="individual" className="space-y-6">
          {/* Agent Selector for Team Leads and Admins */}
          {isAdminOrTeamLead && teamMembers.length > 0 && (
            <Card className="p-6">
              <Label htmlFor="agent-selector">Selecionar Agente</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="agent-selector" className="mt-2">
                  <SelectValue placeholder="Selecione um agente para configurar objetivos" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {isAdmin ? "Selecione um agente ou team lead para configurar objetivos individuais" : "Selecione um agente da sua equipa para configurar objetivos"}
              </p>
            </Card>
          )}

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  {isAdminOrTeamLead && selectedAgent ? "Metas do Agente Selecionado" : "Metas Anuais Pessoais"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Objetivos para {currentYear}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="individual-annual-revenue">Faturação Anual (€)</Label>
                <Input
                  id="individual-annual-revenue"
                  type="number"
                  placeholder="Ex: 100000"
                  value={individualAnnualRevenue}
                  onChange={(e) => setIndividualAnnualRevenue(e.target.value)}
                  className="mt-2"
                  disabled={isAdminOrTeamLead && !selectedAgent}
                />
              </div>
              <div>
                <Label htmlFor="individual-annual-acquisitions">Número de Angariações</Label>
                <Input
                  id="individual-annual-acquisitions"
                  type="number"
                  placeholder="Ex: 10"
                  value={individualAnnualAcquisitions}
                  onChange={(e) => setIndividualAnnualAcquisitions(e.target.value)}
                  className="mt-2"
                  disabled={isAdminOrTeamLead && !selectedAgent}
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Semester 1 */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">1º Semestre</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="individual-s1-revenue">Faturação (€)</Label>
                  <Input
                    id="individual-s1-revenue"
                    type="number"
                    placeholder="Ex: 50000"
                    value={individualS1Revenue}
                    onChange={(e) => setIndividualS1Revenue(e.target.value)}
                    className="mt-2"
                    disabled={isAdminOrTeamLead && !selectedAgent}
                  />
                </div>
                <div>
                  <Label htmlFor="individual-s1-acquisitions">Angariações</Label>
                  <Input
                    id="individual-s1-acquisitions"
                    type="number"
                    placeholder="Ex: 5"
                    value={individualS1Acquisitions}
                    onChange={(e) => setIndividualS1Acquisitions(e.target.value)}
                    className="mt-2"
                    disabled={isAdminOrTeamLead && !selectedAgent}
                  />
                </div>
              </div>
            </Card>

            {/* Semester 2 */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">2º Semestre</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="individual-s2-revenue">Faturação (€)</Label>
                  <Input
                    id="individual-s2-revenue"
                    type="number"
                    placeholder="Ex: 50000"
                    value={individualS2Revenue}
                    onChange={(e) => setIndividualS2Revenue(e.target.value)}
                    className="mt-2"
                    disabled={isAdminOrTeamLead && !selectedAgent}
                  />
                </div>
                <div>
                  <Label htmlFor="individual-s2-acquisitions">Angariações</Label>
                  <Input
                    id="individual-s2-acquisitions"
                    type="number"
                    placeholder="Ex: 5"
                    value={individualS2Acquisitions}
                    onChange={(e) => setIndividualS2Acquisitions(e.target.value)}
                    className="mt-2"
                    disabled={isAdminOrTeamLead && !selectedAgent}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveIndividualGoals}
              disabled={saving || (isAdminOrTeamLead && !selectedAgent)}
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : isAdminOrTeamLead && selectedAgent ? "Guardar Objetivos do Agente" : "Guardar Objetivos Pessoais"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}