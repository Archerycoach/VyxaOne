import { supabase } from "@/integrations/supabase/client";

export interface SMTPSettings {
  id?: string;
  user_id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name?: string;
  is_active: boolean;
  reject_unauthorized?: boolean;
}

export interface EmailData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    encoding?: string;
  }>;
}

/**
 * Get SMTP settings for the current user
 */
export async function getSMTPSettings(): Promise<SMTPSettings | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Using 'as any' to bypass Supabase type checking for the new table
  // until types are fully propagated
  const { data, error } = await (supabase
    .from("user_smtp_settings" as any)
    .select("*")
    .eq("user_id", user.id)
    .single());

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data as unknown as SMTPSettings | null;
}

/**
 * Save or update SMTP settings for the current user
 */
export async function saveSMTPSettings(settings: Omit<SMTPSettings, "id" | "user_id">): Promise<SMTPSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Check if settings already exist
  const existing = await getSMTPSettings();

  if (existing) {
    // Update existing settings
    const { data, error } = await (supabase
      .from("user_smtp_settings" as any)
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single());

    if (error) throw error;
    return data as unknown as SMTPSettings;
  } else {
    // Create new settings
    const { data, error } = await (supabase
      .from("user_smtp_settings" as any)
      .insert({
        ...settings,
        user_id: user.id,
      })
      .select()
      .single());

    if (error) throw error;
    return data as unknown as SMTPSettings;
  }
}

/**
 * Delete SMTP settings for the current user
 */
export async function deleteSMTPSettings(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await (supabase
    .from("user_smtp_settings" as any)
    .delete()
    .eq("user_id", user.id));

  if (error) throw error;
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(settings: Omit<SMTPSettings, "id" | "user_id">): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/api/smtp/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to test SMTP connection",
    };
  }
}

/**
 * Send email using user's SMTP settings
 */
export async function sendEmailViaSMTP(emailData: EmailData): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const response = await fetch("/api/smtp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}