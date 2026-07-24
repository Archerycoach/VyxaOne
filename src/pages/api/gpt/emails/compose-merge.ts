import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";

/**
 * Escreve por IA um email de mala-direta (mail-merge).
 *
 * Diferente do "email por procura" (que parte de uma lead do CRM): aqui os
 * destinatários vêm de uma lista (Excel/CSV) carregada pelo consultor, e as
 * "variáveis" disponíveis são as COLUNAS dessa lista. A IA escreve o assunto e
 * o corpo já com os {tokens} das colunas, para o envio os substituir linha a
 * linha. NÃO envia nada — devolve apenas o rascunho para o consultor rever.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { brief, variables, sample, sourceContent, audience, bookingUrl, propertyUrl } = req.body as {
      brief?: string;
      variables?: string[];
      sample?: Record<string, string> | null;
      /** Texto extraído de um link ou brochura PDF, como base factual. */
      sourceContent?: string | null;
      /** Público-alvo, tom e idioma (ex.: "investidores estrangeiros, em inglês"). */
      audience?: string | null;
      /** Link de reserva de conversa a incluir como CTA. */
      bookingUrl?: string | null;
      /** Link do imóvel a incluir no email (ex.: anúncio). */
      propertyUrl?: string | null;
    };

    if ((!brief || !brief.trim()) && (!sourceContent || !sourceContent.trim())) {
      return res.status(400).json({ error: "Descreva o email ou forneça um link/brochura." });
    }

    const tokens = Array.isArray(variables)
      ? variables.filter((v) => typeof v === "string" && v.trim())
      : [];

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const consultantName = profile?.full_name || "o consultor";

    const variablesBlock = tokens.length
      ? tokens.map((t) => `- {${t}}`).join("\n")
      : "- (nenhuma variável de coluna disponível)";

    // Exemplo de uma linha real, para a IA perceber o tipo de conteúdo de cada
    // variável e escrever de forma natural (sem inventar formatos).
    const sampleBlock =
      sample && typeof sample === "object" && Object.keys(sample).length
        ? "\n\nEXEMPLO DE UMA LINHA (valores reais de um destinatário):\n" +
          Object.entries(sample)
            .filter(([, v]) => v != null && String(v).trim())
            .map(([k, v]) => `- {${k}} = ${String(v).slice(0, 80)}`)
            .join("\n")
        : "";

    // Público-alvo / tom / idioma. É a "vertente" que o consultor escolhe:
    // investidores, clientes estrangeiros (email em inglês), primeira habitação,
    // tom formal, etc. Determina inclusive o IDIOMA do email.
    const audienceBlock =
      audience && audience.trim()
        ? `\n\nPÚBLICO-ALVO, TOM E IDIOMA (segue à risca):\n"${audience.trim()}"`
        : "";

    // Base factual opcional (link ou brochura). Limita-se para não estourar o
    // contexto; a extração já vem truncada, mas cortamos por segurança.
    const sourceBlock =
      sourceContent && sourceContent.trim()
        ? `\n\nMATERIAL DE ORIGEM (link/brochura fornecidos pelo consultor — usa APENAS estes factos, não inventes preços nem características):\n"""\n${sourceContent.trim().slice(0, 6000)}\n"""`
        : "";

    const prompt = `És ${consultantName}, um consultor imobiliário português. Escreve UM email para um envio de mala-direta (mail-merge): o mesmo texto vai para vários destinatários de uma lista, mas cada um recebe as suas variáveis substituídas (como no Word > Excel > Outlook).

PEDIDO DO CONSULTOR (o que o email deve dizer):
"${(brief || "Divulgar o imóvel/assunto do material de origem abaixo.").trim()}"${audienceBlock}${sourceBlock}

VARIÁVEIS DISPONÍVEIS (usa-as escrevendo exatamente {assim}, e serão substituídas por destinatário):
${variablesBlock}${sampleBlock}

${
      bookingUrl
        ? `\nLINK DE RESERVA DE CONVERSA (inclui-o como convite/CTA no fim, com um link HTML usando EXATAMENTE este URL): ${bookingUrl}`
        : ""
    }${
      propertyUrl
        ? `\nLINK DO IMÓVEL (inclui um link "ver o imóvel"/"ver anúncio" com EXATAMENTE este URL): ${propertyUrl}`
        : ""
    }

REGRAS:
- IDIOMA: se o público-alvo acima pedir outro idioma (ex.: inglês para clientes estrangeiros), escreve TODO o email — assunto e corpo — nesse idioma. Caso contrário, português de Portugal.
- Se foi dado um link de reserva ou do imóvel acima, inclui-o como <a href="URL">texto</a> com o URL exato — nunca inventes nem alteres URLs.
- Adapta o tom e os argumentos ao público-alvo indicado (ex.: investidores → rentabilidade, retorno, localização; primeira habitação → conforto, família; estrangeiros → contexto que quem não conhece Portugal precisa). Sem público indicado, tom profissional mas próximo.
- Usa {nome} logo na saudação se essa variável existir. Encaixa outras variáveis onde fizerem sentido natural — nunca as ponhas todas à força.
- Usa APENAS variáveis da lista acima. NUNCA inventes variáveis que não estejam listadas nem deixes chavetas por preencher com nomes que não existem.
- Não incluas assinatura nem despedida com o teu nome (a assinatura é acrescentada automaticamente no envio).
- Corpo em HTML simples (só <p>, <strong>, <br>, <ul>/<li>). Curto e legível.

Responde APENAS com JSON: {"subject": "...", "html": "<p>...</p>"}`;

    const aiResponse = await runAI({
      userId: user.id,
      task: "mail_merge_email",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.6,
    });

    let draft: { subject?: string; html?: string } = {};
    try {
      const cleaned = aiResponse.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      draft = JSON.parse(cleaned.substring(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    } catch {
      return res.status(500).json({ error: "A IA devolveu um formato inesperado. Tenta novamente." });
    }

    if (!draft.subject || !draft.html) {
      return res.status(500).json({ error: "O rascunho veio incompleto. Tenta novamente." });
    }

    return res.status(200).json({ success: true, subject: draft.subject, html: draft.html });
  } catch (error: any) {
    console.error("[compose-merge]", error);
    return res.status(500).json({ error: error.message || "Erro ao escrever o email." });
  }
}
