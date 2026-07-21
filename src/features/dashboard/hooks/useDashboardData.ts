import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getBuyerStages, getSellerStages } from "@/services/pipelineSettingsService";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type CalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];

interface Stats {
  totalLeads: number;
  activeLeads: number;
  leadsByMonth: Array<{ month: string; novas: number }>;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  totalRevenue: number;
  averageResponseTime: string;
  leadsThisMonth: number;
  leadsLastMonth: number;
  leadsGrowth: number;
  newLeadsThisMonth: number;
  scheduledMeetings: number;
  // Goal-related metrics
  annualRevenueGoal: number;
  annualAcquisitionsGoal: number;
  currentSemesterRevenueGoal: number;
  currentSemesterAcquisitionsGoal: number;
  annualRevenueProgress: number;
  annualAcquisitionsProgress: number;
  semesterRevenueProgress: number;
  semesterAcquisitionsProgress: number;
  annualAcquisitionsCount: number;
  semesterAcquisitionsCount: number;
  totalProperties: number;
  activeProperties: number;
  soldProperties: number;
  rentedProperties: number;
  lostProperties: number;
  propertyConversionRate: number;
  totalPropertyRevenue: number;
  averagePropertyResponseTime: string;
  propertiesThisMonth: number;
  propertiesLastMonth: number;
  propertiesGrowth: number;
  newPropertiesThisMonth: number;
  scheduledPropertyMeetings: number;
}

interface UseDashboardDataProps {
  userRole: string | null;
  currentUserId: string | null;
  selectedAgentId?: string | null;
  leadTypeFilter?: "all" | "buyer" | "seller";
}

export function useDashboardData({ userRole, currentUserId, selectedAgentId, leadTypeFilter = "all" }: UseDashboardDataProps) {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    activeLeads: 0,
    leadsByMonth: [],
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    totalRevenue: 0,
    averageResponseTime: "0h",
    leadsThisMonth: 0,
    leadsLastMonth: 0,
    leadsGrowth: 0,
    newLeadsThisMonth: 0,
    scheduledMeetings: 0,
    annualRevenueGoal: 0,
    annualAcquisitionsGoal: 0,
    currentSemesterRevenueGoal: 0,
    currentSemesterAcquisitionsGoal: 0,
    annualRevenueProgress: 0,
    annualAcquisitionsProgress: 0,
    semesterRevenueProgress: 0,
    semesterAcquisitionsProgress: 0,
    annualAcquisitionsCount: 0,
    semesterAcquisitionsCount: 0,
    totalProperties: 0,
    activeProperties: 0,
    soldProperties: 0,
    rentedProperties: 0,
    lostProperties: 0,
    propertyConversionRate: 0,
    totalPropertyRevenue: 0,
    averagePropertyResponseTime: "0h",
    propertiesThisMonth: 0,
    propertiesLastMonth: 0,
    propertiesGrowth: 0,
    newPropertiesThisMonth: 0,
    scheduledPropertyMeetings: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Setup Dates
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const startOfLastMonthDate = startOfMonth(subMonths(now, 1));
      const endOfLastMonthDate = endOfMonth(subMonths(now, 1));
      
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentSemester = currentMonth <= 6 ? 1 : 2;

      // 2. Fetch Pipeline Stages to determine "Won" logic
      const buyerStages = await getBuyerStages();
      const sellerStages = await getSellerStages();
      const lastBuyerStageId = buyerStages[buyerStages.length - 1]?.id;
      const lastSellerStageId = sellerStages[sellerStages.length - 1]?.id;

      // 3. Determine User Filtering Logic
      const targetUserId = selectedAgentId && selectedAgentId !== "all" ? selectedAgentId : null;

      // 4. Fetch Leads
      //
      // O Supabase devolve no máximo 1000 linhas por pedido. Uma consulta
      // única fazia com que o dashboard mostrasse sempre "1000" a partir do
      // momento em que a base passou esse número, por isso percorre-se por
      // páginas até vir tudo. Só se pedem as colunas usadas nas métricas —
      // `select("*")` traria dezenas de campos que aqui não servem para nada.
      const LEADS_BATCH = 1000;
      const leadColumns =
        "id, lead_type, status, assigned_to, created_at, archived_at, budget_max, budget_min";

      const fetchLeadsPage = async (from: number) => {
        let leadsQuery: any = supabase
          .from("leads")
          .select(leadColumns)
          .range(from, from + LEADS_BATCH - 1);

        if (userRole === "admin" || userRole === "broker" || userRole === "team_lead") {
          if (targetUserId) {
            leadsQuery = leadsQuery.eq("assigned_to", targetUserId);
          }
        } else {
          leadsQuery = leadsQuery.eq("assigned_to", currentUserId);
        }

        const { data, error } = await leadsQuery;
        if (error) throw error;
        return (data || []) as any[];
      };

      let leads: any[] = [];
      for (let offset = 0; ; offset += LEADS_BATCH) {
        const batch = await fetchLeadsPage(offset);
        leads = leads.concat(batch);
        if (batch.length < LEADS_BATCH) break;
      }

      // Filter by Lead Type
      if (leadTypeFilter === "buyer") {
        leads = leads.filter(lead => lead.lead_type === "buyer" || lead.lead_type === "both");
      } else if (leadTypeFilter === "seller") {
        leads = leads.filter(lead => lead.lead_type === "seller" || lead.lead_type === "both");
      }

      // 5. Fetch Events
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      let eventsQuery = supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfWeek.toISOString())
        .order("start_time", { ascending: true });

      if (userRole === "admin" || userRole === "broker" || userRole === "team_lead") {
        if (targetUserId) {
          eventsQuery = eventsQuery.eq("user_id", targetUserId);
        }
      } else {
        eventsQuery = eventsQuery.eq("user_id", currentUserId);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;
      
      const events = eventsData || [];
      setUpcomingEvents(events.slice(0, 5));
      const scheduledMeetings = events.filter(e => e.event_type === "meeting").length;

      // 6. Fetch Tasks
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      let tasksQuery = supabase
        .from("tasks")
        .select("*")
        .gte("due_date", startOfDay.toISOString())
        .lte("due_date", endOfToday.toISOString())
        .order("priority", { ascending: false });

      if (userRole === "admin" || userRole === "broker" || userRole === "team_lead") {
        if (targetUserId) {
          tasksQuery = tasksQuery.eq("assigned_to", targetUserId);
        }
      } else {
        tasksQuery = tasksQuery.eq("assigned_to", currentUserId);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;
      setTodayTasks(tasksData || []);

      // 7. Fetch Goals
      const goalType = (userRole === "admin" || userRole === "broker" || userRole === "team_lead") && selectedAgentId === "all" ? "team" : "individual";
      const goalUserId = goalType === "individual" ? (targetUserId || currentUserId) : null;

      let goalsQuery = (supabase as any).from("goals")
        .select("*")
        .eq("goal_type", goalType)
        .eq("year", currentYear);

      if (goalType === "individual" && goalUserId) {
        goalsQuery = goalsQuery.eq("user_id", goalUserId);
      }

      const { data: goalsData, error: goalsError } = await goalsQuery;
      if (goalsError) console.error("Error loading goals:", goalsError);

      const goals = goalsData as any[] || [];
      const annualGoal = goals.find(g => g.period === "annual");
      const semesterGoal = goals.find(g => g.period === "semester" && g.semester === currentSemester);

      const annualRevenueGoal = annualGoal?.revenue_target || 0;
      const annualAcquisitionsGoal = annualGoal?.acquisitions_target || 0;
      const currentSemesterRevenueGoal = semesterGoal?.revenue_target || 0;
      const currentSemesterAcquisitionsGoal = semesterGoal?.acquisitions_target || 0;

      // 8. Fetch Deals for Revenue
      let dealsQuery = (supabase as any).from("deals").select("amount, transaction_date");
      
      if (userRole === "admin" || userRole === "broker" || userRole === "team_lead") {
        if (targetUserId) {
          dealsQuery = dealsQuery.eq("user_id", targetUserId);
        }
      } else {
        dealsQuery = dealsQuery.eq("user_id", currentUserId);
      }

      const { data: dealsData } = await dealsQuery;

      // 9. Fetch Properties
      let propertiesQuery = supabase.from("properties").select("*");
      
      if (userRole === "admin" || userRole === "broker" || userRole === "team_lead") {
        if (targetUserId) {
          propertiesQuery = propertiesQuery.eq("user_id", targetUserId);
        }
      } else {
        propertiesQuery = propertiesQuery.eq("user_id", currentUserId);
      }

      const { data: propertiesData } = await propertiesQuery;
      const properties = propertiesData || [];

      // 10. Calculate Metrics
      const totalLeads = leads.length;

      // Evolução das leads: contagem por mês de criação nos últimos 6 meses.
      // Os meses sem leads têm de aparecer na mesma (a zero) — se fossem
      // omitidos, o gráfico comprimia o eixo e sugeria uma continuidade que
      // não existe.
      const monthBuckets: Array<{ month: string; key: string; novas: number }> = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthBuckets.push({
          month: date.toLocaleDateString("pt-PT", { month: "short" }),
          key: `${date.getFullYear()}-${date.getMonth()}`,
          novas: 0,
        });
      }

      const bucketByKey = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
      for (const lead of leads) {
        if (!lead.created_at) continue;
        const created = new Date(lead.created_at);
        if (Number.isNaN(created.getTime())) continue;
        const bucket = bucketByKey.get(`${created.getFullYear()}-${created.getMonth()}`);
        if (bucket) bucket.novas++;
      }

      const leadsByMonth = monthBuckets.map(({ month, novas }) => ({ month, novas }));
      
      // Identify which stages count as "Acquisition/Angariação"
      // It counts if the stage name implies acquisition
      const acquisitionStageIds = sellerStages
        .filter(s => 
          s.name.toLowerCase().includes("angaria")
        )
        .map(s => s.id);

      const isAcquisition = (l: any) => {
        const statusStr = (l.status || "").toLowerCase();
        const isAtAcquisitionStage = acquisitionStageIds.includes(l.status) || statusStr.includes("angaria");
        // Count as acquisition if it's in the stage and not explicitly a buyer
        return isAtAcquisitionStage && l.lead_type !== "buyer";
      };

      // Calculate won/lost/active leads
      const isWon = (l: any) => {
        const status = l.status || "";
        const statusStr = status.toLowerCase();
        
        if (status === "won") return true;
        
        // Buyers: Conversion is when they reach the last stage (Fechado/Vendido)
        if (l.lead_type === "buyer" || l.lead_type === "both") {
          if (status === lastBuyerStageId || statusStr.includes("fechado") || statusStr.includes("vendido") || statusStr.includes("sold")) {
            return true;
          }
        }
        
        // Sellers: Conversion is when they reach Angariação OR any final closed stage
        if (l.lead_type === "seller" || l.lead_type === "both" || !l.lead_type) {
          if (isAcquisition(l) || status === lastSellerStageId || statusStr.includes("fechado") || statusStr.includes("vendido") || statusStr.includes("sold")) {
            return true;
          }
        }
        
        return false;
      };

      const wonLeads = leads.filter(isWon).length;

      const lostLeads = leads.filter(l => l.status === "lost").length;
      // Ativas = nem ganhas, nem perdidas, nem arquivadas. Calculado por
      // filtro direto e não por subtração: won/lost incluem leads arquivadas,
      // pelo que subtrair podia dar um número abaixo do real (ou negativo).
      const activeLeads = leads.filter(
        (l: any) => !l.archived_at && l.status !== "lost" && !isWon(l)
      ).length;
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

      // Revenue Calculations - ALWAYS use deals, no fallback
      const totalRevenue = dealsData?.reduce((sum: number, deal: any) => sum + Number(deal.amount || 0), 0) || 0;

      // Semester Revenue
      const semesterRevenue = dealsData 
        ? dealsData
            .filter((d: any) => {
              const date = new Date(d.transaction_date);
              const month = date.getMonth() + 1;
              const sem = month <= 6 ? 1 : 2;
              return date.getFullYear() === currentYear && sem === currentSemester;
            })
            .reduce((sum: number, deal: any) => sum + Number(deal.amount || 0), 0)
        : 0;

      // Growth and Time Metrics
      const leadsThisMonth = leads.filter(l => new Date(l.created_at || "").getTime() >= startOfCurrentMonth.getTime()).length;
      const leadsLastMonth = leads.filter(l => {
        const d = new Date(l.created_at || "");
        return d >= startOfLastMonthDate && d <= endOfLastMonthDate;
      }).length;
      const leadsGrowth = leadsLastMonth > 0 ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100 : 0;

      // Calculate actual acquisitions (seller leads strictly at angariação)
      const acquisitionsCount = leads.filter(l => isAcquisition(l)).length;

      // Acquisitions for current year (Contado pelo número de imóveis angariados)
      const annualAcquisitionsCount = properties.filter(p => {
        const dateString = (p as any).acquisition_date || p.created_at || "";
        const createdDate = new Date(dateString);
        return createdDate.getFullYear() === currentYear;
      }).length;

      // Acquisitions for current semester (Contado pelo número de imóveis angariados)
      const semesterAcquisitionsCount = properties.filter(p => {
        const dateString = (p as any).acquisition_date || p.created_at || "";
        const createdDate = new Date(dateString);
        const month = createdDate.getMonth() + 1;
        const semester = month <= 6 ? 1 : 2;
        return createdDate.getFullYear() === currentYear && semester === currentSemester;
      }).length;

      // Progress Metrics - Fixed with correct acquisitions count
      const annualRevenueProgress = annualRevenueGoal > 0 ? (totalRevenue / annualRevenueGoal) * 100 : 0;
      const annualAcquisitionsProgress = annualAcquisitionsGoal > 0 ? (annualAcquisitionsCount / annualAcquisitionsGoal) * 100 : 0;
      const semesterRevenueProgress = currentSemesterRevenueGoal > 0 ? (semesterRevenue / currentSemesterRevenueGoal) * 100 : 0;
      const semesterAcquisitionsProgress = currentSemesterAcquisitionsGoal > 0 ? (semesterAcquisitionsCount / currentSemesterAcquisitionsGoal) * 100 : 0;

      // Property Metrics
      const totalProperties = properties.length;
      const activeProperties = properties.filter(p => p.status === "available" || p.status === "reserved").length;
      const soldProperties = properties.filter(p => p.status === "sold").length;
      const rentedProperties = properties.filter(p => p.status === "rented").length;

      setStats({
        totalLeads,
        activeLeads,
        leadsByMonth,
        wonLeads,
        lostLeads,
        conversionRate,
        totalRevenue,
        averageResponseTime: "2.5h", // Mock value for now
        leadsThisMonth,
        leadsLastMonth,
        leadsGrowth,
        newLeadsThisMonth: leadsThisMonth,
        scheduledMeetings,
        annualRevenueGoal,
        annualAcquisitionsGoal,
        currentSemesterRevenueGoal,
        currentSemesterAcquisitionsGoal,
        annualRevenueProgress,
        annualAcquisitionsProgress,
        semesterRevenueProgress,
        semesterAcquisitionsProgress,
        annualAcquisitionsCount,
        semesterAcquisitionsCount,
        totalProperties,
        activeProperties,
        soldProperties,
        rentedProperties,
        lostProperties: 0,
        propertyConversionRate: 0,
        totalPropertyRevenue: 0,
        averagePropertyResponseTime: "0h",
        propertiesThisMonth: 0,
        propertiesLastMonth: 0,
        propertiesGrowth: 0,
        newPropertiesThisMonth: 0,
        scheduledPropertyMeetings: 0,
      });

    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUserId, userRole, selectedAgentId, leadTypeFilter]);

  return {
    stats,
    upcomingEvents,
    todayTasks,
    loading,
    error,
    refetch: loadDashboardData,
  };
}