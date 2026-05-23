import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { leadId, userId } = req.body;

  if (!leadId || !userId) {
    return res.status(400).json({ error: "Missing leadId or userId" });
  }

  try {
    // 1. Check if user has Notion connected
    const { data: integration } = await supabaseAdmin
      .from("notion_integrations")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!integration?.access_token) {
      return res.status(200).json({ status: "skipped", reason: "notion_not_connected" });
    }

    // 2. Fetch User's Notion Mapping for Leads
    const { data: mapping } = await supabaseAdmin
      .from("notion_mappings")
      .select("*")
      .eq("user_id", userId)
      .eq("entity_type", "leads")
      .maybeSingle();

    if (!mapping?.notion_database_id || !mapping.sync_enabled) {
      return res.status(200).json({ status: "skipped", reason: "leads_not_mapped_or_disabled" });
    }

    // 3. Fetch Lead Data
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // 3.5 Dynamically fetch the Notion Database schema to find the exact name of the Title property
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${mapping.notion_database_id}`, {
      headers: {
        "Authorization": `Bearer ${integration.access_token}`,
        "Notion-Version": "2022-06-28",
      }
    });
    
    if (!dbRes.ok) {
      const err = await dbRes.text();
      return res.status(400).json({ error: "Sem acesso à BD do Notion. Confirme as permissões.", details: err });
    }
    
    const dbData = await dbRes.json();
    const titleProperty = dbData.properties ? Object.values(dbData.properties).find((p: any) => p.type === "title") as any : null;
    const titlePropertyName = titleProperty ? titleProperty.name : "Name";

    // 4. Create Page in Notion
    // We create a rich text page so we don't depend on exact property names in the user's Notion DB, 
    // except for the default "title" property.
    
    const pageData = {
      parent: { database_id: mapping.notion_database_id },
      properties: {
        [titlePropertyName]: {
          title: [
            {
              text: {
                content: lead.name || "Sem Nome",
              },
            },
          ],
        },
      },
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Detalhes do Cliente (Vyxa CRM)" } }]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: "Email: ", link: null }, annotations: { bold: true } },
              { type: "text", text: { content: lead.email || "Não fornecido" } }
            ]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: "Telefone: ", link: null }, annotations: { bold: true } },
              { type: "text", text: { content: lead.phone || "Não fornecido" } }
            ]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: "Origem: ", link: null }, annotations: { bold: true } },
              { type: "text", text: { content: lead.source || "Manual" } }
            ]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: "Status no Vyxa: ", link: null }, annotations: { bold: true } },
              { type: "text", text: { content: lead.status || "new" } }
            ]
          }
        }
      ]
    };

    // Add budget if available
    if (lead.budget_max) {
      pageData.children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { type: "text", text: { content: "Orçamento Máx: ", link: null }, annotations: { bold: true } },
            { type: "text", text: { content: `${lead.budget_max}€` } }
          ]
        }
      } as any);
    }

    // Add notes if available
    if (lead.notes) {
      pageData.children.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: "Notas Iniciais" } }]
        }
      } as any);
      
      // Split notes by newline and create a paragraph for each to respect Notion limits
      const noteLines = lead.notes.split('\n').filter((l: string) => l.trim() !== '');
      for (const line of noteLines) {
        pageData.children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: line.substring(0, 2000) } }] // Notion text limit
          }
        } as any);
      }
    }

    // Decide if creating or updating
    let notionRes;
    if (lead.notion_page_id) {
      // Update existing page (for now just updating properties if we wanted, but we'll focus on creating)
      // If we want to append new notes, we use the blocks endpoint. 
      // For simplicity, we just return if it's already synced to avoid duplicate content on updates.
      return res.status(200).json({ status: "skipped", reason: "already_synced" });
    } else {
      // Create new page
      notionRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${integration.access_token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pageData)
      });
    }

    if (!notionRes.ok) {
      const errorText = await notionRes.text();
      console.error("Notion API error (sync):", errorText);
      let friendlyError = "A API do Notion recusou o pedido.";
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.message) friendlyError = parsed.message;
      } catch (e) {}
      return res.status(notionRes.status).json({ error: friendlyError });
    }

    const notionData = await notionRes.json();

    // Save notion_page_id back to leads
    await supabaseAdmin
      .from("leads")
      .update({ notion_page_id: notionData.id })
      .eq("id", leadId);

    return res.status(200).json({ status: "success", notion_page_id: notionData.id });
  } catch (err) {
    console.error("Unexpected error in Notion sync route:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}