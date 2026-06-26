import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getSellerReportPrompt } from "@/lib/ai/prompts/sellerReport";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const propertyId = req.query.id as string;

    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    // Procurar interações (visitas) associadas a este imóvel
    const { data: interactions } = await supabaseAdmin
      .from("interactions")
      .select("interaction_type, outcome, content, interaction_date")
      .eq("property_id", propertyId)
      .order("interaction_date", { ascending: false });

    // Procurar tarefas relacionadas com o imóvel
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("title, description, completed_at, status")
      .eq("related_property_id", propertyId);

    const prompt = getSellerReportPrompt({
      propertyTitle: property?.title || 'Imóvel',
      referenceCode: property?.reference_code || null,
      price: property?.price || null,
      interactions: interactions || [],
      tasks: tasks || []
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "seller_report",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const generatedHtml = aiResponse.text.trim();

    return res.status(200).json({ success: true, report_html: generatedHtml });
  } catch (error: any) {
    console.error("Seller Report Error:", error);
    return res.status(500).json({ error: error.message });
  }
}