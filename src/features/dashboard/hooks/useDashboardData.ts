import { useState, useEffect } from "react";
import { getLeads } from "@/services/leadsService";
import { getProperties } from "@/services/propertiesService";
import { getTasks } from "@/services/tasksService";
import { getCalendarEvents } from "@/services/calendarService";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Stats {
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  averageBudget: number;
  totalProperties: number;
  availableProperties: number;
  totalTasks: number;
  completedTasks: number;
  todayEvents: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  leadsGrowth: number;
}

interface ChartData {
  month: string;
  leads: number;
  won: number;
}

interface UseDashboardDataProps {
  userRole: string | null;
  currentUserId: string | null;
  selectedAgent: string;
  agents: Profile[];
  period: number;
}

export function useDashboardData({
  userRole,
  currentUserId,
  selectedAgent,
  agents,
  period,
}: UseDashboardDataProps) {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    activeLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    averageBudget: 0,
    totalProperties: 0,
    availableProperties: 0,
    totalTasks: 0,
    completedTasks: 0,
    todayEvents: 0,
    leadsThisMonth: 0,
    leadsLastMonth: 0,
    leadsGrowth: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole && currentUserId) {
      loadDashboardData();
    }
  }, [period, selectedAgent, userRole, currentUserId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [rawLeads, properties, rawTasks, events] = await Promise.all([
        getLeads(false),
        getProperties(),
        getTasks(),
        getCalendarEvents(),
      ]);

      // Filter leads based on role and selection
      let allLeads: Lead[] = [];

      if (userRole === "admin") {
        if (selectedAgent !== "all") {
          allLeads = rawLeads.filter(l => l.assigned_to === selectedAgent);
        } else {
          allLeads = rawLeads;
        }
      } else if (userRole === "team_lead") {
        if (selectedAgent !== "all") {
          allLeads = rawLeads.filter(l => l.assigned_to === selectedAgent);
        } else {
          const teamAgentIds = agents.map(a => a.id);
          allLeads = rawLeads.filter(l => {
            if (l.user_id === currentUserId) return true;
            if (l.assigned_to === currentUserId) return true;
            if (l.assigned_to && teamAgentIds.includes(l.assigned_to)) return true;
            return false;
          });
        }
      } else if (userRole === "agent") {
        allLeads = rawLeads.filter(l => l.assigned_to === currentUserId);
      } else {
        allLeads = rawLeads;
      }

      // Filter tasks based on role
      let tasks = rawTasks;
      if (userRole === "team_lead") {
        const teamAgentIds = agents.map(a => a.id);
        tasks = selectedAgent !== "all"
          ? rawTasks.filter(t => t.assigned_to === selectedAgent)
          : rawTasks.filter(t => t.assigned_to && teamAgentIds.includes(t.assigned_to));
      } else if (userRole === "agent") {
        tasks = rawTasks.filter(t => t.assigned_to === currentUserId);
      }

      // Calculate metrics
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const activeLeads = allLeads.filter(l => !["won", "lost"].includes(l.status || "")).length;
      const wonLeads = allLeads.filter(l => l.status === "won").length;
      const lostLeads = allLeads.filter(l => l.status === "lost").length;

      const leadsThisMonth = allLeads.filter(l => new Date(l.created_at || "") >= startOfMonth).length;
      const leadsLastMonth = allLeads.filter(l => {
        const date = new Date(l.created_at || "");
        return date >= startOfLastMonth && date <= endOfLastMonth;
      }).length;

      const leadsGrowth = leadsLastMonth > 0 ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100 : 0;

      const totalBudget = allLeads.reduce((sum, lead) => {
        const budget = typeof lead.budget === "number" ? lead.budget : Number(lead.budget) || 0;
        return sum + budget;
      }, 0);

      const averageBudget = allLeads.length > 0 ? totalBudget / allLeads.length : 0;
      const conversionRate = allLeads.length > 0 ? (wonLeads / allLeads.length) * 100 : 0;

      const todayEvents = events.filter(e => {
        const eventDate = new Date(e.startTime || "");
        return eventDate.toDateString() === now.toDateString();
      }).length;

      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const availableProperties = properties.filter(p => p.status === "available").length;

      // Generate chart data
      const months: ChartData[] = [];
      for (let i = period - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const monthLeads = allLeads.filter(l => {
          if (!l.created_at) return false;
          const leadDate = new Date(l.created_at);
          if (isNaN(leadDate.getTime())) return false;
          return leadDate >= monthStart && leadDate <= monthEnd;
        });

        const monthWon = monthLeads.filter(l => l.status === "won");

        months.push({
          month: date.toLocaleDateString("pt-PT", { month: "short" }),
          leads: monthLeads.length,
          won: monthWon.length,
        });
      }

      setStats({
        totalLeads: allLeads.length,
        activeLeads,
        wonLeads,
        lostLeads,
        conversionRate,
        averageBudget,
        totalProperties: properties.length,
        availableProperties,
        totalTasks: tasks.length,
        completedTasks,
        todayEvents,
        leadsThisMonth,
        leadsLastMonth,
        leadsGrowth,
      });

      setChartData(months);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    chartData,
    loading,
    refetch: loadDashboardData,
  };
}