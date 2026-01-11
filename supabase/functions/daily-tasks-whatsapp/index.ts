import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("📱 [daily-tasks-whatsapp] Starting WhatsApp task notifications...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check WhatsApp Integration
    const { data: whatsappIntegration, error: whatsappError } = await supabase
      .from("integration_settings")
      .select("settings, is_active")
      .eq("integration_name", "whatsapp")
      .single();

    if (whatsappError || !whatsappIntegration || !whatsappIntegration.is_active) {
      console.error("❌ [daily-tasks-whatsapp] WhatsApp integration not configured or not active");
      return new Response(
        JSON.stringify({ 
          error: "WhatsApp integration not configured",
          success: false 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { phoneNumberId, accessToken } = whatsappIntegration.settings;

    if (!phoneNumberId || !accessToken) {
      console.error("❌ [daily-tasks-whatsapp] WhatsApp credentials incomplete");
      return new Response(
        JSON.stringify({ 
          error: "WhatsApp credentials incomplete",
          success: false 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("✅ [daily-tasks-whatsapp] WhatsApp integration is active");

    // 2. Get users with phone numbers
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, phone, full_name")
      .not("phone", "is", null);

    if (usersError) {
      console.error("❌ [daily-tasks-whatsapp] Error fetching users:", usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log("ℹ️ [daily-tasks-whatsapp] No users with phone numbers");
      return new Response(
        JSON.stringify({ 
          message: "No users to notify",
          success: true,
          sent: 0
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`📱 [daily-tasks-whatsapp] Processing ${users.length} users`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const today = new Date().toISOString().split("T")[0];

    // 3. Process each user
    for (const user of users) {
      try {
        console.log(`🔄 [daily-tasks-whatsapp] Processing user: ${user.full_name || user.phone}`);

        // Fetch tasks for today
        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select(`
            id,
            title,
            description,
            due_time,
            priority,
            lead:leads(name),
            contact:contacts(name)
          `)
          .eq("user_id", user.id)
          .eq("due_date", today)
          .neq("status", "completed")
          .order("priority", { ascending: false });

        if (tasksError) {
          console.error(`❌ [daily-tasks-whatsapp] Error fetching tasks for ${user.phone}:`, tasksError);
          continue;
        }

        if (!tasks || tasks.length === 0) {
          console.log(`ℹ️ [daily-tasks-whatsapp] No tasks for ${user.phone}`);
          continue;
        }

        console.log(`📋 [daily-tasks-whatsapp] Found ${tasks.length} tasks for ${user.phone}`);

        // Build WhatsApp message
        const userName = user.full_name || "Utilizador";
        let message = `Bom dia, ${userName}! 👋

`;
        message += `📋 *Tarefas para hoje (${new Date().toLocaleDateString("pt-PT")})*

`;

        // Group by priority
        const highPriority = tasks.filter((t) => t.priority === "high");
        const mediumPriority = tasks.filter((t) => t.priority === "medium");
        const lowPriority = tasks.filter((t) => t.priority === "low");

        if (highPriority.length > 0) {
          message += `🔴 *ALTA PRIORIDADE:*
`;
          highPriority.forEach((task, index) => {
            const relatedName = task.lead?.name || task.contact?.name || "";
            message += `${index + 1}. *${task.title}*`;
            if (task.due_time) message += ` (${task.due_time})`;
            message += `
`;
            if (relatedName) message += `   👤 ${relatedName}
`;
            if (task.description) message += `   📝 ${task.description.substring(0, 50)}${task.description.length > 50 ? "..." : ""}
`;
            message += `
`;
          });
        }

        if (mediumPriority.length > 0) {
          message += `🟡 *MÉDIA PRIORIDADE:*
`;
          mediumPriority.forEach((task, index) => {
            const relatedName = task.lead?.name || task.contact?.name || "";
            message += `${index + 1}. *${task.title}*`;
            if (task.due_time) message += ` (${task.due_time})`;
            message += `
`;
            if (relatedName) message += `   👤 ${relatedName}
`;
            if (task.description) message += `   📝 ${task.description.substring(0, 50)}${task.description.length > 50 ? "..." : ""}
`;
            message += `
`;
          });
        }

        if (lowPriority.length > 0) {
          message += `🟢 *BAIXA PRIORIDADE:*
`;
          lowPriority.forEach((task, index) => {
            const relatedName = task.lead?.name || task.contact?.name || "";
            message += `${index + 1}. *${task.title}*`;
            if (task.due_time) message += ` (${task.due_time})`;
            message += `
`;
            if (relatedName) message += `   👤 ${relatedName}
`;
            if (task.description) message += `   📝 ${task.description.substring(0, 50)}${task.description.length > 50 ? "..." : ""}
`;
            message += `
`;
          });
        }

        message += `✨ Total: *${tasks.length} tarefas*
`;
        message += `Bom trabalho! 💪`;

        // Format phone number
        let phoneNumber = user.phone.replace(/\D/g, "");
        if (!phoneNumber.startsWith("351") && phoneNumber.length === 9) {
          phoneNumber = "351" + phoneNumber;
        }

        // Send WhatsApp message
        const whatsappResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phoneNumber,
              type: "text",
              text: { body: message },
            }),
          }
        );

        if (whatsappResponse.ok) {
          console.log(`✅ [daily-tasks-whatsapp] Message sent to ${phoneNumber}`);
          results.success++;
        } else {
          const errorText = await whatsappResponse.text();
          console.error(`❌ [daily-tasks-whatsapp] Failed to send to ${phoneNumber}:`, errorText);
          results.failed++;
          results.errors.push(`${phoneNumber}: ${errorText}`);
        }

      } catch (userError: any) {
        console.error(`❌ [daily-tasks-whatsapp] Error processing user ${user.phone}:`, userError);
        results.failed++;
        results.errors.push(`${user.phone}: ${userError.message}`);
      }
    }

    console.log(`✅ [daily-tasks-whatsapp] Completed: ${results.success} sent, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp task notifications completed",
        sent: results.success,
        failed: results.failed,
        errors: results.errors,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("❌ [daily-tasks-whatsapp] Critical error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});