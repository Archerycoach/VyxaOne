import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

interface GoalMetrics {
  annualRevenueTarget: number;
  annualAcquisitionsTarget: number;
  currentSemesterRevenueTarget: number;
  currentSemesterAcquisitionsTarget: number;
}

export function useGoals(userId: string | null, goalType: "team" | "individual" = "individual") {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<GoalMetrics>({
    annualRevenueTarget: 0,
    annualAcquisitionsTarget: 0,
    currentSemesterRevenueTarget: 0,
    currentSemesterAcquisitionsTarget: 0,
  });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentSemester = currentMonth <= 6 ? 1 : 2;

  useEffect(() => {
    if (!userId) return;
    loadGoals();
  }, [userId, goalType]);

  const loadGoals = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Using "as any" to bypass type checking for the new table
      let query = supabase
        .from("goals" as any)
        .select("*")
        .eq("goal_type", goalType)
        .eq("year", currentYear);

      if (goalType === "individual") {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = data as unknown as Goal[];
      setGoals(typedData || []);

      // Calculate metrics
      const annualGoal = typedData?.find(g => g.period === "annual");
      const semesterGoal = typedData?.find(g => g.period === "semester" && g.semester === currentSemester);

      setMetrics({
        annualRevenueTarget: annualGoal?.revenue_target || 0,
        annualAcquisitionsTarget: annualGoal?.acquisitions_target || 0,
        currentSemesterRevenueTarget: semesterGoal?.revenue_target || 0,
        currentSemesterAcquisitionsTarget: semesterGoal?.acquisitions_target || 0,
      });
    } catch (error) {
      console.error("Error loading goals:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    goals,
    metrics,
    loading,
    refetch: loadGoals,
  };
}