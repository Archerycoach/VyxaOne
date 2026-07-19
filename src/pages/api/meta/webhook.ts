import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { buffer } from "micro";
import crypto from "crypto";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { recordConsent } from "@/services/consentService";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { calculateLeadScore } from "@/services/leadScoringService";
import { runNewLeadPipeline } from "@/lib/server/leadPipeline";
import { sendClientEmail } from "@/lib/server/sendClientEmail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Precisamos do corpo em bruto (bytes exatos) para validar a assinatura
// HMAC da Meta — o parser automático do Next.js já teria alterado/reserializado o JSON.
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Verifica a assinatura "x-hub-signature-256" da Meta (HMAC-SHA256 do corpo
 * em bruto, usando o App Secret). MODO OBSERVAÇÃO: por agora só regista o
 * resultado (não bloqueia nenhum pedido) até confirmarmos em produção, com
 * tráfego real da Meta, que a verificação está correta. Retorna null quando
 * não é possível verificar (sem app_secret configurado ou sem header).
 */
function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string | undefined): boolean | null {
  if (!appSecret || !signatureHeader) return null;

  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  try {
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signatureHeader);
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Fan-out multi-instância: uma Meta App só tem UM callback URL, mas há várias
 * instâncias (BDs separadas). A instância que recebe da Meta reencaminha o
 * payload EM BRUTO (com a assinatura original) para as instâncias-peer
 * definidas em META_WEBHOOK_PEERS (URLs separados por vírgula). Cada instância
 * processa apenas as páginas que existem na sua BD; as outras ignoram.
 * Requer o MESMO app_secret configurado em todas (é o mesmo Meta App).
 * O header x-vyxa-forwarded evita loops (um reencaminhamento não é reenviado).
 */
async function forwardToPeers(rawBody: Buffer, signatureHeader: string | undefined, peersStr: string | null | undefined): Promise<void> {
  // Peers gerido no painel de admin (meta_app_settings.webhook_peers), com
  // fallback para a env META_WEBHOOK_PEERS.
  const peers = (peersStr || process.env.META_WEBHOOK_PEERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (peers.length === 0) return;

  await Promise.allSettled(
    peers.map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-vyxa-forwarded": "1",
        };
        if (signatureHeader) headers["x-hub-signature-256"] = signatureHeader;
        await fetch(url, { method: "POST", headers, body: rawBody, signal: controller.signal });
      } catch (e) {
        console.error("[Meta Webhook] Falha ao reencaminhar para peer:", url, e);
      } finally {
        clearTimeout(timer);
      }
    })
  );
}

/**
 * Deteta consentimento de WhatsApp a partir das respostas do formulário da
 * Meta. Prioriza o mapeamento explícito (campo CRM "whatsapp_optin",
 * configurável em Definições > Integrações > Meta); só cai para a deteção
 * por palavras-chave no nome do campo (comportamento antigo, menos fiável)
 * quando não existe esse mapeamento para o formulário.
 */
function detectMetaWhatsAppConsent(
  leadFields: Record<string, string>,
  explicitFieldName: string | undefined,
  explicitValue: unknown
): { granted: boolean; fieldName: string | null; rawValue: string | null } {
  if (explicitFieldName) {
    return {
      granted: explicitValue === true,
      fieldName: explicitFieldName,
      rawValue: leadFields[explicitFieldName] ?? null,
    };
  }

  const whatsappConsentField = Object.keys(leadFields).find(key =>
    key.toLowerCase().includes('whatsapp') &&
    (key.toLowerCase().includes('consent') ||
     key.toLowerCase().includes('aceito') ||
     key.toLowerCase().includes('autorizo') ||
     key.toLowerCase().includes('concordo'))
  );
  const whatsappConsentValue = whatsappConsentField ? leadFields[whatsappConsentField] : null;
  const granted = !!whatsappConsentValue &&
    (whatsappConsentValue.toLowerCase() === 'sim' ||
     whatsappConsentValue.toLowerCase() === 'yes' ||
     whatsappConsentValue.toLowerCase() === 'aceito');

  return { granted, fieldName: whatsappConsentField || null, rawValue: whatsappConsentValue };
}

/**
 * Distribuição automática e equitativa de leads pela equipa: em vez de
 * guardar um ponteiro de rotação (que desalinha facilmente se uma lead for
 * apagada ou reatribuída manualmente), atribui sempre a quem tiver menos
 * leads ativas neste momento — fica equitativo por natureza e autocorrige-se
 * sozinho. O universo de "equipa" replica a mesma regra de visibilidade já
 * usada para atribuição manual (profileService.getUsersForAssignment): um
 * broker/admin distribui por todos os team_leads e consultores; um team_lead
 * só pelos seus próprios consultores.
 */
async function getLeastLoadedTeamMember(
  supabaseClient: any,
  ownerId: string,
  includeOwner: boolean = false
): Promise<string> {
  const { data: ownerProfile } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", ownerId)
    .single();

  let candidateIds: string[] = [ownerId];

  if (ownerProfile?.role === "admin" || ownerProfile?.role === "broker") {
    const { data: members } = await supabaseClient
      .from("profiles")
      .select("id")
      .in("role", ["consultant", "team_lead"])
      .eq("is_active", true);
    if (members && members.length > 0) {
      candidateIds = members.map((m: { id: string }) => m.id);
    }
  } else if (ownerProfile?.role === "team_lead") {
    const { data: members } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("team_lead_id", ownerId)
      .eq("role", "consultant")
      .eq("is_active", true);
    if (members && members.length > 0) {
      candidateIds = members.map((m: { id: string }) => m.id);
    }
  }

  // Por omissão, o broker/team_lead dono da campanha não entra na
  // distribuição (só a equipa) — mas pode optar por se incluir também.
  if (includeOwner && !candidateIds.includes(ownerId)) {
    candidateIds = [...candidateIds, ownerId];
  } else if (!includeOwner) {
    candidateIds = candidateIds.filter((id) => id !== ownerId || candidateIds.length === 1);
  }

  if (candidateIds.length === 1) {
    return candidateIds[0];
  }

  const { data: activeLeads } = await supabaseClient
    .from("leads")
    .select("assigned_to")
    .in("assigned_to", candidateIds)
    .is("archived_at", null)
    .not("status", "in", '("won","lost")');

  const loadByCandidate = new Map<string, number>(candidateIds.map((id) => [id, 0]));
  for (const lead of (activeLeads || []) as { assigned_to: string | null }[]) {
    if (lead.assigned_to && loadByCandidate.has(lead.assigned_to)) {
      loadByCandidate.set(lead.assigned_to, (loadByCandidate.get(lead.assigned_to) || 0) + 1);
    }
  }

  let leastLoadedId = candidateIds[0];
  let leastLoad = Infinity;
  for (const [id, load] of loadByCandidate.entries()) {
    if (load < leastLoad) {
      leastLoad = load;
      leastLoadedId = id;
    }
  }

  return leastLoadedId;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log all incoming requests for diagnostics
  console.log("[Meta Webhook] Incoming request:", {
    method: req.method,
    query: req.query,
    headers: {
      "x-hub-signature-256": req.headers["x-hub-signature-256"],
      "content-type": req.headers["content-type"],
    },
    timestamp: new Date().toISOString(),
  });

  // Verification endpoint for Meta
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("[Meta Webhook] Verification request:", { mode, token: token ? "present" : "missing", challenge: challenge ? "present" : "missing" });

    const { data: settings } = await supabase
      .from("meta_app_settings")
      .select("verify_token")
      .single();

    if (mode === "subscribe" && token === settings?.verify_token) {
      console.log("[Meta Webhook] Verification successful ✓");
      return res.status(200).send(challenge);
    } else {
      console.error("[Meta Webhook] Verification failed - token mismatch");
      return res.status(403).send("Verification failed");
    }
  }

  // Handle webhook events
  if (req.method === "POST") {
    try {
      const rawBody = await buffer(req);

      let body: any;
      try {
        body = JSON.parse(rawBody.toString("utf8"));
      } catch (parseError) {
        console.error("[Meta Webhook] Failed to parse JSON body:", parseError);
        return res.status(400).json({ error: "Invalid JSON" });
      }

      // Verificação de assinatura HMAC-SHA256 da Meta. Se a assinatura for
      // inválida, o pedido é rejeitado (pode ser forjado). Quando não há
      // app_secret configurado nem header, não é possível verificar e o
      // pedido segue (setups antigos sem secret) — mas com app_secret
      // configurado, uma assinatura errada bloqueia.
      const { data: appSettings } = await supabase
        .from("meta_app_settings")
        .select("app_secret, webhook_peers")
        .single();

      const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
      const signatureValid = verifyMetaSignature(rawBody, signatureHeader, appSettings?.app_secret);

      if (signatureValid === false) {
        console.error("[Meta Webhook] ❌ SIGNATURE MISMATCH — pedido rejeitado (payload não vem da Meta)", {
          hasHeader: !!signatureHeader,
        });
        try {
          await supabase.from("meta_webhook_logs").insert({
            page_id: "REJECTED",
            leadgen_id: "REJECTED",
            status: "error",
            webhook_payload: body,
            error_message: "Rejeitado - assinatura inválida (x-hub-signature-256)",
          });
        } catch { /* best-effort */ }
        return res.status(401).json({ error: "Invalid signature" });
      } else if (signatureValid === true) {
        console.log("[Meta Webhook] ✅ Signature verified");
      } else {
        console.warn("[Meta Webhook] Signature verification skipped (sem app_secret configurado ou sem header)", {
          hasSecret: !!appSettings?.app_secret,
          hasHeader: !!signatureHeader,
        });
      }

      console.log("[Meta Webhook] Received POST event:", {
        hasBody: !!body,
        hasEntry: !!body?.entry,
        entryCount: body?.entry?.length || 0,
        fullPayload: JSON.stringify(body, null, 2),
      });

      if (!body || !body.entry) {
        console.error("[Meta Webhook] Invalid payload - missing entry");
        return res.status(400).json({ error: "Invalid payload" });
      }

      // Fan-out para as outras instâncias — só se este pedido veio da Meta
      // (não é já um reencaminhamento). Cada instância processa as suas páginas.
      if (req.headers["x-vyxa-forwarded"] !== "1") {
        await forwardToPeers(rawBody, signatureHeader, (appSettings as any)?.webhook_peers);
      }

      // ALWAYS log the raw hit to DB so we know it reached us
      try {
        await supabase.from("meta_webhook_logs").insert({
          page_id: "RAW_HIT",
          leadgen_id: "RAW_HIT",
          status: "debug",
          webhook_payload: body,
          error_message: signatureValid === true
            ? "Raw hit received - signature_ok"
            : "Raw hit received - signature_not_checked"
        });
      } catch (e) {
        console.error("Failed to log raw hit", e);
      }

      for (const entry of body.entry) {
        const changes = entry.changes || [];
        
        console.log("[Meta Webhook] Processing entry:", {
          entryId: entry.id,
          changesCount: changes.length,
          changes: changes.map(c => ({ field: c.field, hasValue: !!c.value })),
        });

        for (const change of changes) {
          if (change.field !== "leadgen") {
            console.log("[Meta Webhook] Skipping non-leadgen change:", change.field);
            continue;
          }

          const pageId = change.value.page_id;
          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id || null;
          const adId = change.value.ad_id || null;
          
          console.log("[Meta Webhook] Processing leadgen:", {
            pageId,
            leadgenId,
            formId,
            adId,
          });

          // Find the user who owns this page
          const { data: integration } = await supabase
            .from("meta_integrations")
            .select("user_id, page_access_token, page_name")
            .eq("page_id", pageId)
            .eq("is_active", true)
            .single();

          if (!integration) {
            console.error("❌ Page not connected:", pageId);
            await logWebhook(pageId, leadgenId, formId, adId, body, "error", "Page not connected");
            continue;
          }

          // Detect current app URL for email sending
          const protocol = req.headers['x-forwarded-proto'] || 'https';
          const host = req.headers.host;
          const appUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt");

          // Fetch lead details from Meta API
          const leadResponse = await fetch(
            `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${integration.page_access_token}`
          );

          const leadData = await leadResponse.json();

          if (leadData.error) {
            console.error("❌ Error fetching lead:", leadData.error);
            await logWebhook(pageId, leadgenId, formId, adId, body, "error", leadData.error.message);
            continue;
          }

          // Convert field_data to object
          const leadFields: Record<string, string> = {};
          if (leadData.field_data) {
            leadData.field_data.forEach((field: any) => {
              leadFields[field.name] = field.values?.[0] || "";
            });
          }

          console.log("📋 Lead fields:", leadFields);
          
          const emailValue = leadFields.email || "";
          const phoneValue = leadFields.phone_number || leadFields.phone || "";
          
          // Check if this Meta lead was already processed
          const { data: alreadyProcessed } = await supabase
            .from("meta_webhook_logs")
            .select("id")
            .eq("leadgen_id", leadgenId)
            .eq("status", "success")
            .single();

          if (alreadyProcessed) {
            console.log("Lead already processed in logs:", leadgenId);
            continue;
          }

          // Get form config and mappings for this form
          const { data: formConfig } = await supabase
            .from("meta_form_configs")
            .select("*")
            .eq("form_id", formId)
            .eq("is_active", true)
            .single();

          const formAssociation = getMetaFormAssociation(formConfig);

          let fieldMappings = [];
          if (formConfig) {
            const { data } = await supabase
              .from("meta_field_mappings")
              .select("*")
              .eq("form_config_id", formConfig.id);
            fieldMappings = data || [];
          }

          // Apply mappings to get mapped data
          const mappedData: any = { name: leadFields.full_name || leadFields.name || "Lead sem nome" };
          const extraFields: string[] = [];

          for (const [metaField, value] of Object.entries(leadFields)) {
            const fieldName = metaField.toLowerCase();
            const mapping = fieldMappings.find((m: any) => m.meta_field_name === metaField);

            if (mapping) {
              mappedData[mapping.crm_field_name] = value;
            } else {
              if (fieldName.includes("name") || fieldName === "full_name") {
                mappedData.name = value;
              } else if (fieldName.includes("email")) {
                mappedData.email = value;
              } else if (fieldName.includes("phone") || fieldName.includes("telefone")) {
                mappedData.phone = value;
              } else if (fieldName.includes("budget") || fieldName.includes("orcamento") || fieldName.includes("orçamento") || fieldName.includes("investir") || fieldName.includes("valor") || fieldName.includes("preço") || fieldName.includes("preco") || fieldName.includes("máximo") || fieldName.includes("maximo")) {
                console.log(`[Budget Mapping] Found budget field: ${metaField} = ${value}`);
                mappedData.budget_max = value;
              } else if (fieldName.includes("location") || fieldName.includes("bairro") || fieldName.includes("zona") || fieldName === "city") {
                mappedData.location_preference = value;
              } else if (fieldName.includes("tipologia") || fieldName.includes("quartos") || fieldName.includes("assoalhadas")) {
                mappedData.typology = value; // Keep string like "T1", "T2"
                mappedData.bedrooms = value; // Will be parsed to integer (1, 2) below
              } else if (fieldName.includes("property") || fieldName.includes("imovel") || fieldName === "tipo" || fieldName.includes("tipo de im")) {
                mappedData.property_type = value;
              } else if (fieldName.includes("crédito") || fieldName.includes("credito") || fieldName.includes("financiamento")) {
                mappedData.needs_financing = parseBooleanAnswer(value);
              } else if (fieldName.includes("vender") || fieldName.includes("retoma") || fieldName.includes("venda")) {
                mappedData.has_property_to_sell = parseBooleanAnswer(value);
              } else if (fieldName.includes("objetivo") || fieldName.includes("objectivo") || fieldName.includes("procura")) {
                mappedData.buy_purpose = value;
              } else if (fieldName.includes("prazo") || fieldName.includes("quando") || fieldName.includes("timing") || fieldName.includes("compra")) {
                mappedData.purchase_timeline = value;
              } else {
                extraFields.push(`• ${metaField}: ${value}`);
              }
            }
          }

          let combinedNotes = mappedData.notes || "";
          const allOriginalAnswers = Object.entries(leadFields)
            .map(([k, v]) => `• ${k}: ${v}`)
            .join("\n");
          
          combinedNotes = combinedNotes 
            ? `${combinedNotes}\n\nRespostas Originais do Formulário:\n${allOriginalAnswers}` 
            : `Respostas Originais do Formulário:\n${allOriginalAnswers}`;
          
          mappedData.notes = combinedNotes;

          // Sanitize boolean fields (Portuguese "sim"/"não" -> true/false)
          for (const key of Object.keys(mappedData)) {
            if (typeof mappedData[key] === 'string') {
              const lowerVal = mappedData[key].toLowerCase().trim();
              if (lowerVal === 'sim' || lowerVal === 'yes') {
                mappedData[key] = true;
              } else if (
                lowerVal === 'não' || lowerVal === 'nao' || lowerVal === 'no' ||
                lowerVal === 'talvez' || lowerVal === 'maybe'
              ) {
                // "Talvez" é tratado como incerto, tal como "Não" — não é o
                // mesmo que confirmar "Sim". A resposta original completa
                // fica sempre preservada nas notas da lead (ver mais abaixo).
                mappedData[key] = null;
              } else if (key === 'buy_purpose') {
                // Normalize intent
                if (lowerVal.includes('habita')) mappedData[key] = 'housing';
                else if (lowerVal.includes('invest')) mappedData[key] = 'investment';
                else if (lowerVal.includes('secund')) mappedData[key] = 'secondary';
              } else if (key === 'property_type') {
                // Normalize property type
                if (lowerVal.includes('apartamento')) mappedData[key] = 'apartment';
                else if (lowerVal.includes('moradia')) mappedData[key] = 'house';
                else if (lowerVal.includes('terreno')) mappedData[key] = 'land';
                else if (lowerVal.includes('comercial')) mappedData[key] = 'commercial';
                else if (lowerVal.includes('loja')) mappedData[key] = 'store';
              }
            }
          }

          // A limpeza acima só reconhece "sim"/"não"/"yes"/"no" — qualquer
          // outra resposta (ex.: "Talvez", ou texto livre de um mapeamento
          // personalizado) fica como string e falha ao gravar numa coluna
          // booleana real da base de dados. Para os campos que sabemos que
          // são booleanos, garantimos sempre um valor válido.
          const booleanFields = ['has_property_to_sell', 'needs_financing', 'is_development'];
          for (const field of booleanFields) {
            if (typeof mappedData[field] === 'string') {
              const lower = mappedData[field].toLowerCase().trim();
              mappedData[field] = lower === 'true' || lower === 'sim' || lower === 'yes' || lower === '1';
            }
          }

          // Sanitize integer fields (e.g., convert "T1" -> 1, "2 Casas" -> 2)
          const integerFields = ['bedrooms', 'bathrooms', 'score', 'probability', 'lead_score', 'budget', 'budget_min', 'budget_max', 'price'];
          for (const field of integerFields) {
            if (mappedData[field] !== undefined && typeof mappedData[field] === 'string') {
              if (['budget', 'budget_min', 'budget_max', 'price'].includes(field)) {
                console.log(`[Budget Parsing] Field: ${field}, Original value: ${mappedData[field]}`);
                // Special parsing for currency and budgets (e.g. "150.000€ - 200.000€", "Até 250.000")
                // Remove spaces and dots (used as thousand separators in PT)
                let cleanStr = mappedData[field].replace(/\s/g, '').replace(/\./g, '');
                // Remove comma and anything after it (cents like ",00")
                cleanStr = cleanStr.split(',')[0];
                
                const matches = cleanStr.match(/\d+/g);
                if (matches && matches.length > 0) {
                  // Convert all found numbers and take the highest one (for ranges)
                  const numbers = matches.map(m => parseInt(m, 10));
                  let finalValue = Math.max(...numbers);
                  
                  // INTELLIGENT BUDGET PARSING: Values under 1000 are assumed to be in thousands
                  // E.g., "300" -> 300000€ (300 mil), "150" -> 150000€
                  // This handles the common Portuguese real estate convention where people say "300" meaning "300 mil"
                  if (finalValue < 1000) {
                    finalValue = finalValue * 1000;
                  }
                  
                  console.log(`[Budget Parsing] Field: ${field}, Parsed value: ${finalValue}`);
                  mappedData[field] = finalValue;
                } else {
                  // If no numbers found, preserve original text in notes
                  mappedData.notes = mappedData.notes 
                    ? `${mappedData.notes}\n• ${field} (original): ${mappedData[field]}` 
                    : `• ${field} (original): ${mappedData[field]}`;
                  delete mappedData[field];
                }
              } else {
                // Regular parsing for bedrooms, bathrooms
                const match = mappedData[field].match(/\d+/);
                if (match) {
                  mappedData[field] = parseInt(match[0], 10);
                } else {
                  // If it's a string but has no numbers, move it to notes and remove from mappedData
                  mappedData.notes = mappedData.notes 
                    ? `${mappedData.notes}\n• ${field} (original): ${mappedData[field]}` 
                    : `• ${field} (original): ${mappedData[field]}`;
                  delete mappedData[field];
                }
              }
            }
          }

          // "whatsapp_optin" não é uma coluna real da tabela leads — extrai-se
          // aqui para gravar como consentimento (lead_consents) mais abaixo,
          // e nunca é escrito diretamente na lead.
          const explicitWhatsappOptinField = fieldMappings.find(
            (m: any) => m.crm_field_name === "whatsapp_optin"
          )?.meta_field_name;
          const explicitWhatsappOptinValue = mappedData.whatsapp_optin;
          delete mappedData.whatsapp_optin;

          const finalEmail = mappedData.email || emailValue;
          const finalPhone = mappedData.phone || phoneValue;

          // Check if lead already exists by Email or Phone
          let existingLead = null;
          
          if (finalEmail) {
            const { data } = await supabase
              .from("leads")
              .select("*")
              .eq("user_id", integration.user_id)
              .eq("email", finalEmail)
              .limit(1);
            if (data && data.length > 0) existingLead = data[0];
          }
          
          if (!existingLead && finalPhone) {
            const { data } = await supabase
              .from("leads")
              .select("*")
              .eq("user_id", integration.user_id)
              .eq("phone", finalPhone)
              .limit(1);
            if (data && data.length > 0) existingLead = data[0];
          }

          if (existingLead) {
            // Create a note with all updated form fields and notes
            const updatedFields = Object.entries(mappedData)
              .filter(([k, v]) => k !== 'notes' && v)
              .map(([k, v]) => `- **${k}:** ${v}`)
              .join("\n");

            let noteContent = `🔄 **Novo formulário submetido na Meta:**\n\n`;
            if (updatedFields) noteContent += `${updatedFields}\n\n`;
            if (mappedData.notes) noteContent += `**Notas / Campos Extra:**\n${mappedData.notes}\n\n`;
            noteContent += `[MetaLeadID: ${leadgenId}]`;

            await supabase.from("lead_notes").insert({
              lead_id: existingLead.id,
              note: noteContent,
              created_by: integration.user_id
            });

            // ✅ CORREÇÃO: além da nota, preenche também os campos reais da
            // lead com os dados mapeados deste formulário — antes disto, só
            // ficavam guardados como texto na nota, nunca na ficha. Só
            // preenche campos que a lead ainda tem vazios, para nunca
            // sobrescrever uma correção manual já feita pelo consultor.
            const fieldsToFill: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(mappedData)) {
              if (key === "notes") continue;
              if (value === undefined || value === null || value === "") continue;
              const currentValue = (existingLead as Record<string, unknown>)[key];
              if (currentValue === undefined || currentValue === null || currentValue === "") {
                fieldsToFill[key] = value;
              }
            }

            // Marca a resubmissão: a lead volta ao topo da lista (a ordenação
            // usa esta data em vez da criação) e passa a mostrar o indicador
            // de que voltou a preencher um formulário.
            const previousCount = Number((existingLead as any).form_submissions_count) || 1;
            const resubmissionUpdate = {
              ...fieldsToFill,
              last_form_submission_at: new Date().toISOString(),
              form_submissions_count: previousCount + 1,
              updated_at: new Date().toISOString(),
            };

            const { error: updateError } = await supabase
              .from("leads")
              .update(resubmissionUpdate as any)
              .eq("id", existingLead.id);

            if (updateError) {
              console.error("❌ Erro ao atualizar a lead existente:", updateError);
            } else {
              console.log(
                `✅ Lead ${existingLead.id} voltou a submeter formulário (${previousCount + 1}ª vez). Campos preenchidos:`,
                Object.keys(fieldsToFill)
              );
            }

            // Notifica o consultor — é um sinal de intenção forte.
            await supabase.from("notifications").insert({
              user_id: integration.user_id,
              title: `🔁 ${existingLead.name || "Lead"} voltou a contactar`,
              message: `Submeteu um novo formulário na Meta. É a ${previousCount + 1}ª submissão desta lead.`,
              notification_type: "info",
              is_read: false,
              related_entity_id: existingLead.id,
              related_entity_type: "lead",
            } as any);

            await applyMetaFormAssociation(existingLead.id, formAssociation, existingLead.custom_fields);

            console.log("✅ Note added to existing lead:", existingLead.id);

            // Regista consentimento de WhatsApp também para leads já
            // existentes que voltem a submeter o formulário (antes, isto só
            // acontecia para leads novas).
            const existingLeadConsent = detectMetaWhatsAppConsent(leadFields, explicitWhatsappOptinField, explicitWhatsappOptinValue);
            if (existingLeadConsent.granted) {
              console.log(`[Meta Webhook] Lead existente ${existingLead.id} deu consentimento de WhatsApp via formulário`);
              await recordConsent(
                existingLead.id,
                integration.user_id,
                "granted",
                "meta_form",
                supabase,
                `${existingLeadConsent.fieldName}: ${existingLeadConsent.rawValue}`,
                `meta_form:${formId}:${leadgenId}:${new Date().toISOString()}`
              );
            }

            // Apanha, em segundo plano, qualquer dado de qualificação que
            // não bateu com nenhuma regra fixa de mapeamento acima.
            triggerAutoNotesAnalysis(appUrl, integration.user_id, existingLead.id);
            
            // ✅ Run pipeline for existing lead (notification + auto-responder with anti-duplication)
            await runNewLeadPipeline({
              supabase: supabase as any,
              userId: integration.user_id,
              lead: {
                id: existingLead.id,
                name: existingLead.name,
                email: finalEmail,
                phone: finalPhone,
              },
              appUrl,
              leadFields,
              isExistingLead: true,
            });
            
            // Log successful webhook
            await logWebhook(pageId, leadgenId, formId, adId, body, "success", null);
            continue;
          }

          // Map Meta fields to CRM fields for NEW lead
          // Sanitize status to avoid "t1" invalid integer syntax if pipeline uses UUIDs or specific strings
          let safeStatus = formConfig?.default_status || "new";
          if (safeStatus === "t1" || safeStatus === "t2" || safeStatus === "t3") {
             safeStatus = "new"; // fallback to 'new' if it's a mock ID
          }

          // Distribuição pela equipa (quando ativada para este formulário) ou
          // atribuição fixa, tal como configurado em Definições > Meta.
          const assignedTo = (formConfig as any)?.auto_assign_mode === "team_round_robin"
            ? await getLeastLoadedTeamMember(supabase, integration.user_id, !!(formConfig as any)?.auto_assign_include_owner)
            : (formConfig?.auto_assign_to || integration.user_id);

          const leadRecord = {
            ...mappedData,
            user_id: integration.user_id,
            assigned_to: assignedTo,
            email: finalEmail || null,
            phone: finalPhone || null,
            source: `Meta Lead Ads - ${integration.page_name || 'Facebook'}`, // Set specific origin in the correct column
            status: safeStatus,
            meta_lead_id: leadgenId,
            meta_form_id: formId,
            meta_ad_id: adId,
            created_at: leadData.created_time || new Date().toISOString(),
            lead_type: formConfig?.default_lead_type || "buyer", // Strict mapping based on form config
          };

          // Remove any undefined values
          Object.keys(leadRecord).forEach(key => {
            if (leadRecord[key] === undefined) delete leadRecord[key];
          });

          // Create lead in CRM
          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert(leadRecord)
            .select()
            .single();

          if (leadError) {
            console.error("❌ Error creating lead:", leadError);
            await logWebhook(pageId, leadgenId, formId, adId, body, "error", leadError.message);
            continue;
          }

          console.log("✅ Lead created:", newLead.id);

          // Email de resposta automática configurável por formulário/campanha
          // (independente do workflow genérico "meta_lead_created", que é
          // por utilizador, não por formulário).
          if ((formConfig as any)?.auto_reply_enabled && (formConfig as any)?.auto_reply_subject && finalEmail) {
            try {
              const replaceVars = (str: string) => str
                .replace(/\{nome\}/g, newLead.name || "")
                .replace(/\{email\}/g, finalEmail)
                .replace(/\{telefone\}/g, finalPhone || "");

              const subject = replaceVars((formConfig as any).auto_reply_subject);
              const html = replaceVars((formConfig as any).auto_reply_body || "").replace(/\n/g, "<br>");

              const emailResult = await sendClientEmail({
                supabaseAdmin: supabase,
                userId: integration.user_id,
                leadId: newLead.id,
                leadName: newLead.name,
                source: "meta_auto_reply",
                to: finalEmail,
                subject,
                html,
              });

              if (emailResult.success) {
                await logEmailInteractionServer(supabase, {
                  leadId: newLead.id,
                  userId: integration.user_id,
                  to: finalEmail,
                  subject,
                  body: html,
                  outcome: `Resposta automática enviada (formulário: ${formConfig?.form_name || formId})`,
                  updateLastContact: false,
                });
              } else {
                console.error("❌ Falha ao enviar resposta automática do formulário:", emailResult.error);
              }
            } catch (autoReplyError) {
              console.error("❌ Erro ao enviar resposta automática do formulário:", autoReplyError);
            }
          }

          // Apanha, em segundo plano, qualquer dado de qualificação que não
          // bateu com nenhuma regra fixa de mapeamento (fica só no campo
          // "notes" da lead com as respostas originais do formulário).
          triggerAutoNotesAnalysis(appUrl, integration.user_id, newLead.id);

          await applyMetaFormAssociation(newLead.id, formAssociation, newLead.custom_fields);

          // ✅ Calculate initial lead score for new lead
          await calculateLeadScore(newLead.id, supabase, "new_lead_meta");

          // Detect WhatsApp Consent from Meta Form
          const newLeadConsent = detectMetaWhatsAppConsent(leadFields, explicitWhatsappOptinField, explicitWhatsappOptinValue);
          const hasWhatsAppConsent = newLeadConsent.granted;

          if (hasWhatsAppConsent && finalPhone) {
            console.log(`[Meta Webhook] Lead ${newLead.id} granted WhatsApp consent via Meta form`);

            // Record WhatsApp consent with full GDPR evidence
            const consentText = `${newLeadConsent.fieldName}: ${newLeadConsent.rawValue}`;
            const evidenceRef = `meta_form:${formId}:${leadgenId}:${new Date().toISOString()}`;

            await recordConsent(
              newLead.id,
              integration.user_id,
              "granted",
              "meta_form",
              supabase,
              consentText,
              evidenceRef
            );
            
            // Check if user has WhatsApp module enabled
            const { data: userProfile } = await supabase
              .from("profiles")
              .select("whatsapp_module_enabled")
              .eq("id", integration.user_id)
              .maybeSingle();

            if (userProfile?.whatsapp_module_enabled) {
              // Send first contact template (NEVER free message - no 24h window yet!)
              const templateResult = await sendWhatsAppTemplate(
                integration.user_id,
                finalPhone,
                "primeiro_contacto", // This template must be approved in Meta Business Manager
                supabase,
                newLead.id,
                false,
                "meta_first_contact"
              );

              if (templateResult.success) {
                console.log(`✅ WhatsApp first contact template sent to ${newLead.name}`);
                
                // Register as interaction (but NOT whatsapp_inbound - that only happens when lead REPLIES)
                await supabase.from("interactions").insert({
                  lead_id: newLead.id,
                  user_id: integration.user_id,
                  interaction_type: "whatsapp",
                  content: `Template de primeiro contacto enviado via WhatsApp`,
                  interaction_date: new Date().toISOString()
                });
                
                // Update follow_up_state to first_contact
                await supabase.from("leads").update({
                  follow_up_state: "first_contact"
                }).eq("id", newLead.id);
              } else {
                console.error(`❌ Failed to send WhatsApp template: ${templateResult.error}`);
              }
            } else {
              console.log(`[Meta Webhook] User ${integration.user_id} does not have WhatsApp module enabled`);
            }
          } else if (newLeadConsent.fieldName && !hasWhatsAppConsent) {
            console.log(`[Meta Webhook] Lead ${newLead.id} did NOT grant WhatsApp consent (field: ${newLeadConsent.fieldName}, value: ${newLeadConsent.rawValue})`);
          }

          // Create internal notification
          await supabase.from("notifications").insert({
            user_id: integration.user_id,
            title: "🎯 Nova Lead da Meta",
            content: `A lead ${newLead.name} acabou de entrar através do Facebook/Instagram.`,
            type: "lead_assignment",
            link_url: `/leads`,
            is_read: false
          });

          // ✅ Run unified pipeline: notification → auto-responder → AI matcher → Notion
          await runNewLeadPipeline({
            supabase: supabase as any,
            userId: integration.user_id,
            lead: {
              id: newLead.id,
              name: newLead.name,
              email: finalEmail,
              phone: finalPhone,
              lead_type: newLead.lead_type,
            },
            appUrl,
            leadFields,
            isExistingLead: false,
          });

          // Log successful webhook
          await logWebhook(pageId, leadgenId, formId, adId, body, "success", null);
        }
      }

      console.log("[Meta Webhook] Successfully processed all entries");
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Meta Webhook] Error processing webhook:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  console.log("[Meta Webhook] Method not allowed:", req.method);
  return res.status(405).json({ error: "Method not allowed" });
}

/**
 * Dispara (sem esperar) a análise automática de notas por IA — apanha
 * respostas do formulário da Meta que não bateram com nenhuma regra fixa de
 * mapeamento e, se possível, preenche os campos de qualificação ainda
 * vazios da lead. Nunca sobrescreve um campo já preenchido (ver modo "auto"
 * em src/pages/api/gpt/leads/[id]/analyze-notes.ts). Não bloqueia nem falha
 * o processamento do webhook se der erro.
 */
/**
 * Converte uma resposta de formulário da Meta (texto livre, ex.: "Sim",
 * "Não", "Yes") num boolean real, para os campos que são colunas booleanas
 * na base de dados (needs_financing, has_property_to_sell). Sem esta
 * conversão, gravar o texto tal como veio causa um erro de tipo na base de
 * dados e pode impedir a lead de ser criada.
 */
function parseBooleanAnswer(value: string): boolean {
  const normalized = String(value).trim().toLowerCase();
  return ["sim", "s", "yes", "y", "true", "1"].includes(normalized);
}

function triggerAutoNotesAnalysis(appUrl: string, userId: string, leadId: string): void {
  fetch(`${appUrl}/api/gpt/leads/${leadId}/analyze-notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ mode: "auto", userId }),
  }).catch((err) => console.error("[Meta Webhook] Falha ao disparar análise automática de notas:", err));
}

async function logWebhook(
  pageId: string,
  leadgenId: string,
  formId: string | undefined,
  adId: string | undefined,
  payload: any,
  status: string,
  errorMessage: string | null
) {
  const { error } = await supabase
    .from("meta_webhook_logs")
    .insert({
      page_id: pageId,
      leadgen_id: leadgenId,
      form_id: formId,
      ad_id: adId,
      webhook_payload: payload,
      status: status,
      error_message: errorMessage,
    });
    
  if (error) {
    console.error("Failed to insert into meta_webhook_logs:", error);
  }
}

function getMetaFormAssociation(formConfig: any): {
  type: "none" | "property" | "development";
  propertyId: string | null;
  developmentId: string | null;
  developmentName: string | null;
} {
  const settings =
    formConfig?.custom_settings && typeof formConfig.custom_settings === "object"
      ? formConfig.custom_settings
      : {};

  const associationType =
    settings.association_type === "property" || settings.association_type === "development"
      ? settings.association_type
      : "none";

  return {
    type: associationType,
    propertyId: typeof settings.associated_property_id === "string" ? settings.associated_property_id : null,
    developmentId: typeof settings.associated_development_id === "string" ? settings.associated_development_id : null,
    developmentName:
      typeof settings.associated_development_name === "string"
        ? settings.associated_development_name
        : null,
  };
}

async function applyMetaFormAssociation(
  leadId: string,
  association: ReturnType<typeof getMetaFormAssociation>,
  currentCustomFields?: Record<string, unknown> | null
) {
  if (association.type === "property" && association.propertyId) {
    const { error } = await supabase
      .from("properties")
      .update({
        lead_id: leadId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", association.propertyId);

    if (error) {
      throw error;
    }

    return;
  }

  if (association.type === "development" && (association.developmentId || association.developmentName)) {
    const nextCustomFields =
      currentCustomFields && typeof currentCustomFields === "object" && !Array.isArray(currentCustomFields)
        ? { ...currentCustomFields }
        : {};

    const { error } = await supabase
      .from("leads")
      .update({
        is_development: true,
        development_id: association.developmentId,
        development_name: association.developmentName,
        custom_fields: {
          ...nextCustomFields,
          meta_association_type: "development",
          meta_associated_development_id: association.developmentId,
          meta_associated_development_name: association.developmentName,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (error) {
      throw error;
    }
  }
}