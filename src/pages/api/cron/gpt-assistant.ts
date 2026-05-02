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
  // Permitir GET para testes locais e POST para Vercel Cron
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validação de segurança do CRON
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.CRON_SECRET_TOKEN}`;

  if (req.method === "POST" && (!authHeader || authHeader !== expectedToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!openAIApiKey) {
    console.error("OPENAI_API_KEY não está configurada nas variáveis de ambiente.");
    return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar utilizadores ativos (comerciais/agentes)
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("is_active", true);

    if (usersError || !users) {
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        console.log(`🧠 Processando GPT para: ${user.email}`);

        // Verificar se tem SMTP configurado (se não, não consegue receber o email)
        const { data: smtpSettings } = await supabase
          .from("user_smtp_settings")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (!smtpSettings) {
          console.log(`⏭️ Sem SMTP configurado para ${user.email}, ignorado.`);
          results.skipped++;
          continue;
        }

        // Buscar leads pendentes do utilizador (limitar a 15 para não exceder limites de tokens do modelo)
        const { data: leads } = await supabase
          .from("leads")
          .select("id, name, status, last_contact_date, next_follow_up, lead_type")
          .eq("assigned_to", user.id)
          .is("archived_at", null)
          .not("status", "in", '("won", "lost")')
          .order("next_follow_up", { ascending: true })
          .limit(15);

        if (!leads || leads.length === 0) {
          console.log(`⏭️ Sem leads ativas suficientes para ${user.email}.`);
          results.skipped++;
          continue;
        }

        // Instruções para o OpenAI (System Prompt)
        const prompt = `És um assistente de vendas de elite de uma agência imobiliária. 
Analisa as seguintes leads pendentes do consultor/agente ${user.full_name || 'Utilizador'}.
Com base no estado e datas de follow_up (prioriza as que têm data de follow-up expirada ou mais antiga), redige um resumo diário.
Gera 3 prioridades MÁXIMAS e claras para o dia de hoje que ele deve focar-se a contactar.

A tua resposta DEVE ser estritamente escrita num formato de email profissional em HTML seguro.
Usa as tags <h3>, <p>, <ul>, <li>, <strong>, e <br>. Não uses blocos de código Markdown. Não cries tags <html> ou <body>, devolve apenas o conteúdo do corpo.
Tem um tom motivador e direto ao assunto para fechar vendas.

Aqui estão os dados brutos das leads (formato JSON):
${JSON.stringify(leads, null, 2)}`;

        // Pedido à OpenAI (Usamos gpt-4o-mini por ser rápido, inteligente e barato)
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
          console.error(`Erro da OpenAI para ${user.email}:`, errorText);
          results.failed++;
          continue;
        }

        const gptData = await openAiRes.json();
        const gptMessage = gptData.choices[0].message.content;

        // Enviar o resultado por Email usando as definições SMTP do próprio comercial
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
          subject: "🤖 O seu Resumo Diário GPT - Análise de Leads",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1e293b;">
              
              <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">Plano de Vendas Diário</h2>
                <p style="color: #64748b; margin-top: 5px; font-size: 14px;">A sua análise automática baseada em IA</p>
              </div>

              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 20px 0; font-size: 15px; line-height: 1.6;">
                ${gptMessage}
              </div>

              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  Gerado automaticamente pelo seu Agente Vyxa AI às 08h30.
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 5px;">
                  Vá ao seu <a href="https://www.vyxa.pt/dashboard" style="color: #4f46e5; text-decoration: none;">Dashboard</a> para começar o dia.
                </p>
              </div>

            </div>
          `
        });

        console.log(`✅ Resumo GPT enviado com sucesso para ${user.email}`);
        results.success++;
      } catch (err) {
        console.error(`Erro ao processar utilizador ${user.email}:`, err);
        results.failed++;
        results.errors.push(`${user.email}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error("GPT CRON Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}