import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function validateGptRequest(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return null;
  }
  
  const apiKey = authHeader.split(" ")[1];
  
  const { data: keyData, error } = await (supabaseAdmin
    .from("gpt_api_keys" as any)
    .select("user_id, is_active")
    .eq("api_key", apiKey)
    .single() as unknown as Promise<any>);
    
  if (error || !keyData || !keyData.is_active) {
    res.status(401).json({ error: "Invalid or inactive API key" });
    return null;
  }
  
  // Update last used at asynchronously
  supabaseAdmin
    .from("gpt_api_keys" as any)
    .update({ last_used_at: new Date().toISOString() })
    .eq("api_key", apiKey)
    .then();
    
  return keyData.user_id;
}

export async function logGptAction(userId: string, action: string, entityType: string, entityId: string | null, details: any = {}) {
  await (supabaseAdmin.from("activity_logs" as any).insert({
    user_id: userId,
    action: action,
    entity_type: entityType,
    entity_id: entityId,
    details: { ...details, source: "gpt_agent" }
  }) as unknown as Promise<any>);
}