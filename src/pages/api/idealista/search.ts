import { NextApiRequest, NextApiResponse } from "next";
import { searchIdealistaProperties } from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get global Idealista credentials (server-side only)
    const credentials = await getIdealistaCredentials();

    const results = await searchIdealistaProperties(req.body, credentials);
    return res.status(200).json(results);
  } catch (error: any) {
    console.error("Idealista search error:", error);
    return res.status(500).json({ 
      error: error.message || "Erro ao pesquisar no Idealista"
    });
  }
}