import type { NextApiRequest, NextApiResponse } from "next";
import { searchIdealistaProperties } from "@/services/idealistaService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { params, userId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: "Utilizador não autenticado" });
    }

    const properties = await searchIdealistaProperties(params, userId);
    
    return res.status(200).json({ properties });
  } catch (error: any) {
    console.error("Idealista search error:", error);
    return res.status(500).json({ 
      error: error.message || "Erro ao pesquisar imóveis no Idealista" 
    });
  }
}