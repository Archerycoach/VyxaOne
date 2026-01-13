import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, CheckCircle, Clock, XCircle, Edit, Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import {
  getAllSubscriptions,
  getSubscriptionPlans,
  createSubscription,
  updateSubscriptionStatus,
  extendSubscription,
  getSubscriptionStats,
  type SubscriptionWithPlan,
  type SubscriptionPlan,
} from "@/services/subscriptionService";
import { getUserProfile } from "@/services/profileService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StatusType = "trialing" | "active" | "cancelled" | "past_due" | "unpaid";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function SubscriptionsManagement() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithPlan[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    trial: 0,
    cancelled: 0,
    expired: 0,
  });
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false);
  const [isEditPlanDialogOpen, setIsEditPlanDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("active");

  // Form states for creating subscription
  const [newSubscription, setNewSubscription] = useState({
    userId: "",
    planId: "",
    trialDays: 0,
  });

  // Form states for managing subscription
  const [editForm, setEditForm] = useState({
    status: "" as StatusType,
    extendMonths: 0,
  });

  // Form states for plan management
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    price: 0,
    currency: "EUR",
    billing_interval: "monthly" as "monthly" | "yearly",
    features: [] as string[],
    is_active: true,
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const profile = await getUserProfile();
      if (!profile || profile.role !== "admin") {
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para aceder esta página.",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/dashboard");
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subsData, plansData, statsData] = await Promise.all([
        getAllSubscriptions(),
        getSubscriptionPlans(),
        getSubscriptionStats(),
      ]);
      setSubscriptions(subsData);
      setPlans(plansData);
      setStats(statsData);

      // Load user profiles for all subscriptions
      const userIds = subsData.map(sub => sub.user_id);
      await loadUserProfiles(userIds);
      
      // Load all users for the combobox
      await loadAllUsers();
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das subscrições.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfiles = async (userIds: string[]) => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (error) throw error;

      const profilesMap = new Map<string, UserProfile>();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
      setUserProfiles(profilesMap);
    } catch (error) {
      console.error("Error loading user profiles:", error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setAllUsers(profiles || []);
    } catch (error) {
      console.error("Error loading all users:", error);
    }
  };

  const handleCreateSubscription = async () => {
    try {
      if (!newSubscription.userId || !newSubscription.planId) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      const result = await createSubscription(
        newSubscription.userId,
        newSubscription.planId,
        newSubscription.trialDays
      );

      if (result) {
        toast({
          title: "Sucesso",
          description: "Subscrição criada com sucesso!",
        });
        setNewSubscription({ userId: "", planId: "", trialDays: 0 });
        await loadData();
        setActiveTab("active");
      }
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar subscrição.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async () => {
    try {
      if (!selectedSubscription || !editForm.status) {
        toast({
          title: "Erro",
          description: "Selecione um status válido.",
          variant: "destructive",
        });
        return;
      }

      const success = await updateSubscriptionStatus(
        selectedSubscription.id,
        editForm.status
      );

      if (success) {
        toast({
          title: "Sucesso",
          description: "Status da subscrição atualizado!",
        });
        setIsManageDialogOpen(false);
        setSelectedSubscription(null);
        await loadData();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da subscrição.",
        variant: "destructive",
      });
    }
  };

  const handleExtendSubscription = async () => {
    try {
      if (!selectedSubscription || editForm.extendMonths <= 0) {
        toast({
          title: "Erro",
          description: "Insira um número válido de meses.",
          variant: "destructive",
        });
        return;
      }

      const success = await extendSubscription(
        selectedSubscription.id,
        editForm.extendMonths
      );

      if (success) {
        toast({
          title: "Sucesso",
          description: `Subscrição estendida por ${editForm.extendMonths} ${editForm.extendMonths === 1 ? "mês" : "meses"}!`,
        });
        setIsManageDialogOpen(false);
        setSelectedSubscription(null);
        setEditForm({ status: "" as StatusType, extendMonths: 0 });
        await loadData();
      }
    } catch (error) {
      console.error("Error extending subscription:", error);
      toast({
        title: "Erro",
        description: "Erro ao estender subscrição.",
        variant: "destructive",
      });
    }
  };

  const handleCreatePlan = async () => {
    try {
      if (!planForm.name || planForm.price <= 0) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("subscription_plans")
        .insert({
          name: planForm.name,
          description: planForm.description,
          price: planForm.price,
          currency: planForm.currency,
          billing_interval: planForm.billing_interval,
          features: planForm.features,
          is_active: planForm.is_active,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Plano criado com sucesso!",
      });
      setIsCreatePlanDialogOpen(false);
      setPlanForm({
        name: "",
        description: "",
        price: 0,
        currency: "EUR",
        billing_interval: "monthly",
        features: [],
        is_active: true,
      });
      await loadData();
    } catch (error) {
      console.error("Error creating plan:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar plano.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePlan = async () => {
    try {
      if (!selectedPlan || !planForm.name || planForm.price <= 0) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("subscription_plans")
        .update({
          name: planForm.name,
          description: planForm.description,
          price: planForm.price,
          currency: planForm.currency,
          billing_interval: planForm.billing_interval,
          features: planForm.features,
          is_active: planForm.is_active,
        })
        .eq("id", selectedPlan.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Plano atualizado com sucesso!",
      });
      setIsEditPlanDialogOpen(false);
      setSelectedPlan(null);
      await loadData();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar plano.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Tem certeza que deseja eliminar este plano?")) return;

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Plano eliminado com sucesso!",
      });
      await loadData();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({
        title: "Erro",
        description: "Erro ao eliminar plano.",
        variant: "destructive",
      });
    }
  };

  const openManageDialog = (subscription: SubscriptionWithPlan) => {
    setSelectedSubscription(subscription);
    setEditForm({
      status: subscription.status as StatusType,
      extendMonths: 0,
    });
    setIsManageDialogOpen(true);
  };

  const openEditPlanDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    // Ensure features is treated as string array
    const features = Array.isArray(plan.features) 
      ? (plan.features as unknown as string[]) 
      : [];
      
    setPlanForm({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      currency: plan.currency,
      billing_interval: plan.billing_interval as "monthly" | "yearly",
      features: features,
      is_active: plan.is_active,
    });
    setIsEditPlanDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      trialing: { variant: "secondary", label: "Teste" },
      active: { variant: "default", label: "Ativa" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      past_due: { variant: "outline", label: "Vencida" },
      unpaid: { variant: "destructive", label: "Não Paga" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const profile = userProfiles.get(sub.user_id);
    const userName = profile?.full_name || "";
    const userEmail = profile?.email || "";
    const planName = sub.subscription_plans?.name || "";
    
    const matchesSearch = 
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      planName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar subscrições...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-600">
                Total Subscrições
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
                <Users className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-600">
                Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-700">{stats.active}</div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-600">
                Em Teste
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-700">{stats.trial}</div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-600">
                Expiradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-red-700">{stats.expired}</div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="active">Subscrições Ativas</TabsTrigger>
            <TabsTrigger value="plans">Planos Disponíveis</TabsTrigger>
            <TabsTrigger value="manage-plans">Gestão de Planos</TabsTrigger>
            <TabsTrigger value="create">Criar Subscrição</TabsTrigger>
          </TabsList>

          {/* Subscriptions List Tab */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Subscrições</CardTitle>
                <CardDescription>Gerir todas as subscrições dos utilizadores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Pesquisar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                <div className="mb-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="trialing">Teste</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                      <SelectItem value="past_due">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilizador</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((sub) => {
                      const profile = userProfiles.get(sub.user_id);
                      return (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{profile?.full_name || "N/A"}</div>
                              <div className="text-sm text-gray-500">{profile?.email || "N/A"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {sub.subscription_plans?.name || "N/A"}
                          </TableCell>
                          <TableCell>{getStatusBadge(sub.status)}</TableCell>
                          <TableCell>{formatDate(sub.current_period_start)}</TableCell>
                          <TableCell>{formatDate(sub.current_period_end)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openManageDialog(sub)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Gerir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Available Plans Tab */}
          <TabsContent value="plans">
            <Card>
              <CardHeader>
                <CardTitle>Planos Disponíveis</CardTitle>
                <CardDescription>Visualizar todos os planos de subscrição</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.filter(plan => plan.is_active).map((plan) => (
                    <Card key={plan.id}>
                      <CardHeader>
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold mb-4">
                          {plan.price}€
                          <span className="text-sm font-normal text-gray-500">
                            /{plan.billing_interval === "monthly" ? "mês" : "ano"}
                          </span>
                        </div>
                        {Array.isArray(plan.features) && plan.features.length > 0 && (
                          <ul className="space-y-2">
                            {(plan.features as unknown as string[]).map((feature, index) => (
                              <li key={index} className="flex items-center text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Plans Tab */}
          <TabsContent value="manage-plans">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestão de Planos</CardTitle>
                    <CardDescription>Criar, editar e eliminar planos</CardDescription>
                  </div>
                  <Button onClick={() => setIsCreatePlanDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Plano
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.price}€</TableCell>
                        <TableCell>
                          {plan.billing_interval === "monthly" ? "Mensal" : "Anual"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plan.is_active ? "default" : "secondary"}>
                            {plan.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditPlanDialog(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePlan(plan.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Subscription Tab */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Criar Nova Subscrição</CardTitle>
                <CardDescription>Criar uma subscrição para um utilizador</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  <div>
                    <Label htmlFor="userId">Utilizador *</Label>
                    <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userComboboxOpen}
                          className="w-full justify-between"
                        >
                          {newSubscription.userId
                            ? allUsers.find((user) => user.id === newSubscription.userId)?.full_name || "Selecione um utilizador"
                            : "Selecione um utilizador"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Pesquisar utilizador..." />
                          <CommandEmpty>Nenhum utilizador encontrado.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {allUsers.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={`${user.full_name} ${user.email}`}
                                onSelect={() => {
                                  setNewSubscription({ ...newSubscription, userId: user.id });
                                  setUserComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newSubscription.userId === user.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{user.full_name}</span>
                                  <span className="text-xs text-gray-500">{user.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {newSubscription.userId && (
                      <p className="text-xs text-gray-500 mt-1">
                        ID: {newSubscription.userId}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="planId">Plano *</Label>
                    <Select
                      value={newSubscription.planId}
                      onValueChange={(value) =>
                        setNewSubscription({ ...newSubscription, planId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.filter(p => p.is_active).map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - {plan.price}€/{plan.billing_interval === "monthly" ? "mês" : "ano"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="trialDays">Dias de Trial (opcional)</Label>
                    <Input
                      id="trialDays"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={newSubscription.trialDays}
                      onChange={(e) =>
                        setNewSubscription({
                          ...newSubscription,
                          trialDays: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button onClick={handleCreateSubscription} className="w-full">
                    Criar Subscrição
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Manage Subscription Dialog */}
        <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerir Subscrição</DialogTitle>
              <DialogDescription>
                Altere o status ou estenda a subscrição
              </DialogDescription>
            </DialogHeader>
            {selectedSubscription && (
              <div className="space-y-4">
                <div>
                  <Label>Utilizador</Label>
                  <p className="text-sm text-gray-600">
                    {userProfiles.get(selectedSubscription.user_id)?.full_name || "N/A"}
                  </p>
                </div>
                <div>
                  <Label>Plano Atual</Label>
                  <p className="text-sm text-gray-600">
                    {selectedSubscription.subscription_plans?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="editStatus">Alterar Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value: StatusType) =>
                      setEditForm({ ...editForm, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trialing">Teste</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                      <SelectItem value="past_due">Vencida</SelectItem>
                      <SelectItem value="unpaid">Não Paga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="extendMonths">Estender Subscrição (meses)</Label>
                  <Input
                    id="extendMonths"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editForm.extendMonths}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        extendMonths: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsManageDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button variant="secondary" onClick={handleExtendSubscription}>
                Estender
              </Button>
              <Button onClick={handleUpdateStatus}>Atualizar Status</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Plan Dialog */}
        <Dialog open={isCreatePlanDialogOpen} onOpenChange={setIsCreatePlanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Plano</DialogTitle>
              <DialogDescription>
                Defina os detalhes do novo plano de subscrição
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="planName">Nome do Plano *</Label>
                <Input
                  id="planName"
                  placeholder="Ex: Professional"
                  value={planForm.name}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="planDescription">Descrição</Label>
                <Input
                  id="planDescription"
                  placeholder="Descrição do plano"
                  value={planForm.description}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planPrice">Preço *</Label>
                  <Input
                    id="planPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={planForm.price}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="planInterval">Intervalo</Label>
                  <Select
                    value={planForm.billing_interval}
                    onValueChange={(value: "monthly" | "yearly") =>
                      setPlanForm({ ...planForm, billing_interval: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreatePlanDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreatePlan}>Criar Plano</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Plan Dialog */}
        <Dialog open={isEditPlanDialogOpen} onOpenChange={setIsEditPlanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Plano</DialogTitle>
              <DialogDescription>
                Atualize os detalhes do plano de subscrição
              </DialogDescription>
            </DialogHeader>
            {selectedPlan && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editPlanName">Nome do Plano *</Label>
                  <Input
                    id="editPlanName"
                    value={planForm.name}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="editPlanDescription">Descrição</Label>
                  <Input
                    id="editPlanDescription"
                    value={planForm.description}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editPlanPrice">Preço *</Label>
                    <Input
                      id="editPlanPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={planForm.price}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPlanInterval">Intervalo</Label>
                    <Select
                      value={planForm.billing_interval}
                      onValueChange={(value: "monthly" | "yearly") =>
                        setPlanForm({ ...planForm, billing_interval: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={planForm.is_active ? "active" : "inactive"}
                    onValueChange={(value) =>
                      setPlanForm({ ...planForm, is_active: value === "active" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditPlanDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdatePlan}>Atualizar Plano</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}