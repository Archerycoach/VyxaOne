import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppSettings {
  phone_number?: string;
  phone_number_id: string;
  is_active: boolean;
}

// Optional parameter for server-side usage
export async function getWhatsAppSettings(userId: string, supabaseClient = supabase): Promise<WhatsAppSettings | null> {
  const { data, error } = await supabaseClient
    .from("whatsapp_settings" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching WhatsApp settings:", error);
    return null;
  }

  return data as unknown as WhatsAppSettings;
}

export async function checkWhatsAppModule(userId: string, supabaseClient = supabase): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("whatsapp_module_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching WhatsApp module status:", error);
    return false;
  }

  return !!data?.whatsapp_module_enabled;
}

/**
 * Send a WhatsApp message using the Meta Cloud API
 */
export async function sendWhatsAppMessage(
  userId: string, 
  to: string, 
  message: string,
  supabaseClient = supabase
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check if user has opted in to WhatsApp locally via Admin module
    const hasModule = await checkWhatsAppModule(userId, supabaseClient);
    
    if (!hasModule) {
      return { success: false, error: "O módulo de WhatsApp não está ativo para este utilizador." };
    }

    // Get Admin Global API token and phone number
    const { data: adminSettings } = await supabaseClient
      .from("integration_settings")
      .select("settings, is_active")
      .eq("integration_name", "whatsapp_api")
      .maybeSingle();

    if (!adminSettings || !adminSettings.is_active || !adminSettings.settings) {
      return { success: false, error: "A API Global do WhatsApp não está configurada." };
    }

    const { access_token, phone_number_id } = adminSettings.settings as any;
    if (!access_token || !phone_number_id) {
      return { success: false, error: "Access Token ou Phone Number ID não encontrados nas definições globais." };
    }

    // Format phone number: remove non-digits, ensure it doesn't have a leading +
    const formattedPhone = to.replace(/\D/g, '');

    const response = await fetch(`https://graph.facebook.com/v19.0/${phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: {
          preview_url: true,
          body: message
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      return { success: false, error: data.error?.message || "Erro na API do WhatsApp" };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id 
    };

  } catch (error: any) {
    console.error("Failed to send WhatsApp message:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a WhatsApp Template message using the Meta Cloud API
 * Required for initiating conversations with users
 */
export async function sendWhatsAppTemplate(
  userId: string, 
  to: string, 
  templateName: string,
  supabaseClient = supabase
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check if user has opted in to WhatsApp locally via Admin module
    const hasModule = await checkWhatsAppModule(userId, supabaseClient);
    
    if (!hasModule) {
      return { success: false, error: "O módulo de WhatsApp não está ativo para este utilizador." };
    }

    // Get Admin Global API token and phone number
    const { data: adminSettings } = await supabaseClient
      .from("integration_settings")
      .select("settings, is_active")
      .eq("integration_name", "whatsapp_api")
      .maybeSingle();

    if (!adminSettings || !adminSettings.is_active || !adminSettings.settings) {
      return { success: false, error: "A API Global do WhatsApp não está configurada." };
    }

    const { access_token, phone_number_id } = adminSettings.settings as any;
    if (!access_token || !phone_number_id) {
      return { success: false, error: "Access Token ou Phone Number ID não encontrados nas definições globais." };
    }

    const formattedPhone = to.replace(/\D/g, '');

    const response = await fetch(`https://graph.facebook.com/v19.0/${phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: "pt_PT"
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      return { success: false, error: data.error?.message || "Erro na API do WhatsApp" };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id 
    };

  } catch (error: any) {
    console.error("Failed to send WhatsApp template:", error);
    return { success: false, error: error.message };
  }
}