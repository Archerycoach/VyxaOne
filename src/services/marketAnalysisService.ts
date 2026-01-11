import { supabase } from "@/integrations/supabase/client";

export interface MarketTrend {
  period: string;
  avgPrice: number;
  avgDaysToSell: number;
  volume: number;
}

export interface MarketStats {
  totalProperties: number;
  avgPrice: number;
  activeCount: number;
  soldCount: number;
  avgPricePerSqm: number;
  avgDaysToSell: number;
}

export const getMarketAnalysis = async (zone?: string): Promise<MarketStats> => {
  try {
    let query = supabase
      .from("properties")
      .select("price, created_at, status, city, area, updated_at");
    
    if (zone) {
      query = query.ilike("city", `%${zone}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        totalProperties: 0,
        avgPrice: 0,
        activeCount: 0,
        soldCount: 0,
        avgPricePerSqm: 0,
        avgDaysToSell: 0,
      };
    }

    // Calculate real statistics from actual data
    const totalProperties = data.length;
    const validPrices = data.filter(p => p.price && p.price > 0);
    const avgPrice = validPrices.length > 0
      ? validPrices.reduce((acc, curr) => acc + (curr.price || 0), 0) / validPrices.length
      : 0;

    const activeCount = data.filter(p => p.status === "available").length;
    const soldCount = data.filter(p => p.status === "sold").length;

    // Calculate average price per square meter
    const propertiesWithArea = data.filter(p => p.price && p.area && p.price > 0 && p.area > 0);
    const avgPricePerSqm = propertiesWithArea.length > 0
      ? propertiesWithArea.reduce((acc, curr) => acc + (curr.price! / curr.area!), 0) / propertiesWithArea.length
      : 0;

    // Calculate average days to sell (for sold properties)
    const soldProperties = data.filter(p => p.status === "sold" && p.created_at && p.updated_at);
    const avgDaysToSell = soldProperties.length > 0
      ? soldProperties.reduce((acc, curr) => {
          const created = new Date(curr.created_at!).getTime();
          const updated = new Date(curr.updated_at!).getTime();
          const days = Math.floor((updated - created) / (1000 * 60 * 60 * 24));
          return acc + days;
        }, 0) / soldProperties.length
      : 0;

    return {
      totalProperties,
      avgPrice: Math.round(avgPrice),
      activeCount,
      soldCount,
      avgPricePerSqm: Math.round(avgPricePerSqm),
      avgDaysToSell: Math.round(avgDaysToSell),
    };
  } catch (error) {
    console.error("Error in getMarketAnalysis:", error);
    throw error;
  }
};

export const getPriceHistory = async (zone?: string, months: number = 6): Promise<{ month: string; price: number }[]> => {
  try {
    const today = new Date();
    const monthsAgo = new Date(today);
    monthsAgo.setMonth(monthsAgo.getMonth() - months);

    let query = supabase
      .from("properties")
      .select("price, created_at, city")
      .gte("created_at", monthsAgo.toISOString())
      .order("created_at", { ascending: true });

    if (zone) {
      query = query.ilike("city", `%${zone}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      // Return empty array if no data
      return [];
    }

    // Group by month and calculate average price
    const monthlyData: { [key: string]: { total: number; count: number } } = {};
    
    data.forEach(property => {
      if (!property.price || !property.created_at) return;
      
      const date = new Date(property.created_at);
      const monthKey = date.toLocaleDateString("pt-PT", { month: "short", year: "numeric" });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, count: 0 };
      }
      
      monthlyData[monthKey].total += property.price;
      monthlyData[monthKey].count += 1;
    });

    // Convert to array and calculate averages
    const result = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      price: Math.round(data.total / data.count),
    }));

    return result;
  } catch (error) {
    console.error("Error in getPriceHistory:", error);
    throw error;
  }
};

export const getPropertyTypeDistribution = async (zone?: string) => {
  try {
    let query = supabase
      .from("properties")
      .select("property_type");

    if (zone) {
      query = query.ilike("city", `%${zone}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data) return [];

    // Count by type
    const typeCounts: { [key: string]: number } = {};
    data.forEach(property => {
      const type = property.property_type || "Outro";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / data.length) * 100),
    }));
  } catch (error) {
    console.error("Error in getPropertyTypeDistribution:", error);
    throw error;
  }
};

export const getTopLocations = async (limit: number = 5) => {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("city, price");

    if (error) throw error;
    if (!data) return [];

    // Group by city
    const cityData: { [key: string]: { count: number; totalPrice: number } } = {};
    
    data.forEach(property => {
      const city = property.city || "Desconhecido";
      if (!cityData[city]) {
        cityData[city] = { count: 0, totalPrice: 0 };
      }
      cityData[city].count += 1;
      if (property.price) {
        cityData[city].totalPrice += property.price;
      }
    });

    // Convert to array and sort by count
    const result = Object.entries(cityData)
      .map(([city, data]) => ({
        city,
        count: data.count,
        avgPrice: data.count > 0 ? Math.round(data.totalPrice / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return result;
  } catch (error) {
    console.error("Error in getTopLocations:", error);
    throw error;
  }
};