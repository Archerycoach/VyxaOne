import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Deal {
  id: string;
  user_id: string;
  lead_id: string | null;
  deal_type: "seller" | "buyer" | "both";
  transaction_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface NewDeal {
  deal_type: "seller" | "buyer" | "both";
  transaction_date: string;
  amount: number;
  notes: string | null;
}

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeals = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any).from("deals")
        .select("*")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error("Error loading deals:", error);
    } finally {
      setLoading(false);
    }
  };

  const addDeal = async (deal: NewDeal) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await (supabase as any).from("deals").insert({
      ...deal,
      user_id: user.id,
    });

    if (error) throw error;
  };

  const updateDeal = async (id: string, deal: Partial<NewDeal>) => {
    const { error } = await (supabase as any).from("deals")
      .update(deal)
      .eq("id", id);

    if (error) throw error;
  };

  const deleteDeal = async (id: string) => {
    const { error } = await (supabase as any).from("deals")
      .delete()
      .eq("id", id);

    if (error) throw error;
  };

  useEffect(() => {
    loadDeals();
  }, []);

  return {
    deals,
    loading,
    addDeal,
    updateDeal,
    deleteDeal,
    refetch: loadDeals,
  };
}