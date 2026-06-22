import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Cron Job: Meta Leads Auto-Sync
 * 
 * Executa sincronização automática diária das leads da Meta para todas as integrações
 * que tenham auto_daily_sync ativado.
 * 
 * Configurado no vercel.json para executar diariamente às 6h UTC.
 * 
 * A lógica de sincronização está na Edge Function: supabase/functions/meta-leads-sync
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Meta Auto-Sync] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Meta Auto-Sync] Starting daily sync at", new Date().toISOString());

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Call the Supabase Edge Function for meta-leads-sync
    const functionUrl = `${supabaseUrl}/functions/v1/meta-leads-sync`;
    
    console.log("[Meta Auto-Sync] Calling Edge Function:", functionUrl);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        trigger: "cron",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Meta Auto-Sync] Edge Function error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Edge Function failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log("[Meta Auto-Sync] Sync completed successfully:", {
      integrations_processed: result.results?.integrations_processed,
      leads_fetched: result.results?.leads_fetched,
      leads_created: result.results?.leads_created,
      leads_skipped: result.results?.leads_skipped,
    });

    return res.status(200).json({
      success: true,
      message: "Meta auto-sync completed",
      results: result.results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[Meta Auto-Sync] Fatal error:", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
}