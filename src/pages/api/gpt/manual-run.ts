import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openAIApiKey = process.env.OPENAI_API_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!openAIApiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is missing. Por favor adicione nas variáveis de ambiente." });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Buscar leads pendentes do utilizador (limitado a 15)
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, status, last_contact_date, next_follow_up, lead_type")
      .eq("assigned_to", user.id)
      .is("archived_at", null)
      .not("status", "in", '("won", "lost")')
      .order("next_follow_up", { ascending: true })
      .limit(15);

    if (!leads || leads.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "<p>Nenhuma lead urgente pendente encontrada. Bom trabalho!</p>", 
        emailSent: false 
      });
    }

    // Instruções para o OpenAI (System Prompt) - Similar ao CRON
    const prompt = `És um assistente de vendas de elite de uma agência imobiliária. 
Analisa as seguintes leads pendentes do consultor/agente ${profile?.full_name || 'Utilizador'}.
Com base no estado e datas de follow_up (prioriza as que têm data de follow-up expirada ou mais antiga), redige um resumo diário.
Gera 3 prioridades MÁXIMAS e claras para agora que ele deve focar-se a contactar.

A tua resposta DEVE ser estritamente escrita num formato HTML seguro para web.
Usa apenas as tags <h3>, <p>, <ul>, <li>, <strong>, e <br>. Não uses blocos de código Markdown. Não cries tags <html> ou <body>, devolve apenas o conteúdo.
Tem um tom motivador e direto ao assunto para fechar vendas.

Aqui estão os dados brutos das leads (formato JSON):
${JSON.stringify(leads, null, 2)}`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        temperature: 0.7
      })
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("OpenAI erro:", errorText);
      throw new Error("Falha ao comunicar com a OpenAI");
    }

    const gptData = await openAiRes.json();
    const gptMessage = gptData.choices[0].message.content;

    let emailSent = false;

    // Verificar se tem SMTP para enviar uma cópia
    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (smtpSettings) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpSettings.smtp_host,
          port: smtpSettings.smtp_port,
          secure: smtpSettings.smtp_secure,
          auth: {
            user: smtpSettings.smtp_username,
            pass: smtpSettings.smtp_password,
          },
          tls: {
            rejectUnauthorized: smtpSettings.reject_unauthorized ?? true,
          },
        });

        await transporter.sendMail({
          from: `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`,
          to: user.email,
          subject: "🤖 O seu Resumo GPT - Execução Manual",
          html: `
            <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
              <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">Resumo Analítico a Pedido</h2>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; line-height: 1.6;">
                ${gptMessage}
              </div>
            </div>
          `
        });
        emailSent = true;
      } catch (e) {
        console.error("Erro ao enviar email manual:", e);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: gptMessage, 
      emailSent 
    });
  } catch (error) {
    console.error("Manual Run Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}