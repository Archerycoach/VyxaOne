import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/meta/forms?integration_id={id}
 * Lista todos os formulários de uma integração Meta
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { integration_id } = req.query;

    if (!integration_id || typeof integration_id !== "string") {
      return res.status(400).json({ error: "integration_id is required" });
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from("meta_integrations")
      .select("*")
      .eq("id", integration_id)
      .eq("user_id", user.id)
      .single();

    if (integrationError || !integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Fetch forms from Meta Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${integration.page_id}/leadgen_forms?` +
      `access_token=${integration.page_access_token}&` +
      `fields=id,name,status,leads_count,created_time`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Meta API error:", errorData);
      return res.status(500).json({ error: "Failed to fetch forms from Meta" });
    }

    const data = await response.json();
    const forms = data.data || [];

    // Get existing configs for these forms
    const formIds = forms.map((f: any) => f.id);
    const { data: existingConfigs } = await supabase
      .from("meta_form_configs")
      .select("*")
      .eq("user_id", user.id)
      .eq("integration_id", integration_id)
      .in("form_id", formIds);

    // Merge configs with forms
    const formsWithConfigs = forms.map((form: any) => {
      const config = existingConfigs?.find((c: any) => c.form_id === form.id);
      return {
        ...form,
        config: config || null,
      };
    });

    return res.status(200).json({ forms: formsWithConfigs });
  } catch (error) {
    console.error("Error in Meta forms API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}