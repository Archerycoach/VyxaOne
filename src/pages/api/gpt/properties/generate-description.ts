import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getPropertyDescriptionPrompt } from "@/lib/ai/prompts/propertyDescription";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { keywords, propertyDetails } = req.body;

    const prompt = getPropertyDescriptionPrompt({
      keywords: keywords || "",
      propertyDetails: propertyDetails || {}
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "property_description",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const generatedText = aiResponse.text.trim();

    return res.status(200).json({ success: true, description: generatedText });
  } catch (error: any) {
    console.error("Generate Description Error:", error);
    return res.status(500).json({ error: error.message });
  }
}