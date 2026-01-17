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
      let leadsQuery = supabase.from("leads").select("*");

      if (userRole === "admin" || userRole === "team_lead") {
        if (targetUserId) {
          leadsQuery = leadsQuery.eq("assigned_to", targetUserId);
        }
      } else {
        leadsQuery = leadsQuery.eq("assigned_to", currentUserId);
      }

      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      let leads = leadsData || [];

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

      if (userRole === "admin" || userRole === "team_lead") {
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

      if (userRole === "admin" || userRole === "team_lead") {
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
      const goalType = (userRole === "admin" || userRole === "team_lead") && selectedAgentId === "all" ? "team" : "individual";
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
      
      if (userRole === "admin" || userRole === "team_lead") {
        if (targetUserId) {
          dealsQuery = dealsQuery.eq("user_id", targetUserId);
        }
      } else {
        dealsQuery = dealsQuery.eq("user_id", currentUserId);
      }

      const { data: dealsData } = await dealsQuery;

      // 9. Calculate Metrics
      const totalLeads = leads.length;
      
      // Calculate won/lost/active leads
      const wonLeads = leads.filter(l => {
        const status = l.status || "";
        if (status === "won") return true;
        if (l.lead_type === "buyer" && status === lastBuyerStageId) return true;
        if (l.lead_type === "seller" && status === lastSellerStageId) return true;
        return false;
      }).length;

      const lostLeads = leads.filter(l => l.status === "lost").length;
      const activeLeads = leads.length - wonLeads - lostLeads; // Simplified active logic
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

      // Revenue Calculations
      // Use deals if available, fallback to legacy calculation
      const dealsRevenue = dealsData?.reduce((sum: number, deal: any) => sum + Number(deal.amount), 0) || 0;
      const totalRevenue = dealsData && dealsData.length > 0 ? dealsRevenue : (wonLeads * 5000);

      // Semester Revenue
      const semesterRevenue = dealsData 
        ? dealsData
            .filter((d: any) => {
              const date = new Date(d.transaction_date);
              const month = date.getMonth() + 1;
              const sem = month <= 6 ? 1 : 2;
              return date.getFullYear() === currentYear && sem === currentSemester;
            })
            .reduce((sum: number, deal: any) => sum + Number(deal.amount), 0)
        : 0;

      // Growth and Time Metrics
      const leadsThisMonth = leads.filter(l => new Date(l.created_at || "").getTime() >= startOfCurrentMonth.getTime()).length;
      const leadsLastMonth = leads.filter(l => {
        const d = new Date(l.created_at || "");
        return d >= startOfLastMonthDate && d <= endOfLastMonthDate;
      }).length;
      const leadsGrowth = leadsLastMonth > 0 ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100 : 0;

      // Progress Metrics
      const annualRevenueProgress = annualRevenueGoal > 0 ? (totalRevenue / annualRevenueGoal) * 100 : 0;
      const annualAcquisitionsProgress = annualAcquisitionsGoal > 0 ? (totalLeads / annualAcquisitionsGoal) * 100 : 0;
      const semesterRevenueProgress = currentSemesterRevenueGoal > 0 ? (semesterRevenue / currentSemesterRevenueGoal) * 100 : 0;
      const semesterAcquisitionsProgress = currentSemesterAcquisitionsGoal > 0 ? (totalLeads / 2 / currentSemesterAcquisitionsGoal) * 100 : 0;

      setStats({
        totalLeads,
        activeLeads,
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