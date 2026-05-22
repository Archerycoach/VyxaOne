import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/notion/callback`;

  if (!clientId || !process.env.NOTION_CLIENT_SECRET) {
    return res.status(500).json({ 
      error: "Notion credentials not configured. Please add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET to environment variables." 
    });
  }

  // Pass userId in the state parameter so we can associate the token later
  const state = encodeURIComponent(JSON.stringify({ userId }));
  
  // Notion OAuth URL
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.redirect(302, notionAuthUrl);
}