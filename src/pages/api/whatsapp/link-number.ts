import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Número de telemóvel é obrigatório" });

    // 1. Obter as credenciais globais de Admin
    const { data: adminSettings } = await supabaseAdmin
      .from("integration_settings")
      .select("settings, is_active")
      .eq("integration_name", "whatsapp_api")
      .maybeSingle();

    if (!adminSettings || !adminSettings.is_active || !adminSettings.settings) {
      return res.status(400).json({ error: "A API Global do WhatsApp não está configurada pelo Administrador." });
    }

    const { access_token, business_account_id } = adminSettings.settings as any;
    if (!access_token || !business_account_id) {
      return res.status(400).json({ error: "A API Global do WhatsApp está incompleta." });
    }

    // 2. Procurar os números registados na Meta Business Account
    const response = await fetch(`https://graph.facebook.com/v19.0/${business_account_id}/phone_numbers?access_token=${access_token}`);
    const data = await response.json();

    if (!response.ok) {
      console.error("Meta API error:", data);
      return res.status(500).json({ error: "Erro ao comunicar com a Meta API." });
    }

    // 3. Encontrar o ID do número de telemóvel que o utilizador introduziu
    const cleanInputPhone = phoneNumber.replace(/\D/g, "");
    
    const phoneMatch = data.data?.find((p: any) => {
      const cleanMetaPhone = p.display_phone_number.replace(/\D/g, "");
      return cleanMetaPhone.includes(cleanInputPhone) || cleanInputPhone.includes(cleanMetaPhone);
    });

    if (!phoneMatch) {
      const availableNumbers = data.data?.map((p: any) => p.display_phone_number).join(", ") || "Nenhum";
      return res.status(404).json({ 
        error: `Número não encontrado na conta Meta. Números disponíveis na conta: ${availableNumbers}. Certifique-se que o ID da conta está correto e o número foi adicionado no WhatsApp Manager.` 
      });
    }

    // 4. Guardar a configuração para o utilizador
    const { error: upsertError } = await supabaseAdmin
      .from("whatsapp_settings")
      .upsert({
        user_id: user.id,
        phone_number: phoneNumber,
        phone_number_id: phoneMatch.id,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (upsertError) throw upsertError;

    return res.status(200).json({ 
      success: true, 
      phone_number_id: phoneMatch.id 
    });
  } catch (error: any) {
    console.error("Error linking WhatsApp number:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}