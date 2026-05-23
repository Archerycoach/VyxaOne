import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  // Fetch Notion settings from the database
  const { data: configData, error } = await supabase
    .from('integration_settings')
    .select('*')
    .eq('integration_name', 'notion')
    .maybeSingle();

  const settings = (configData?.settings as any) || {};

  if (error || !settings.client_id || !settings.client_secret) {
    return res.status(500).json({ 
      error: "O administrador ainda não configurou as chaves de acesso do Notion no painel de Integrações." 
    });
  }

  const clientId = settings.client_id;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/notion/callback`;

  // Pass userId in the state parameter so we can associate the token later
  const state = encodeURIComponent(JSON.stringify({ userId }));
  
  // Notion OAuth URL
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.redirect(302, notionAuthUrl);
}