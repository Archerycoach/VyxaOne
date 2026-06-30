import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { findLeadsForProperty } from "@/services/matchingService";

/**
 * Reverse Match Cron Job
 * 
 * Executa diariamente para encontrar leads interessadas em imóveis novos.
 * Quando um imóvel novo entra no sistema:
 * - Encontra todas as leads com match >= 70%
 * - Cria notificação para o consultor aprovar o envio
 * - Não envia nada automaticamente aos clientes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autorização do cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log("[Reverse Match] Iniciando verificação de novos imóveis...");

    // Encontrar imóveis criados nas últimas 24 horas que ainda não foram processados
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: newProperties, error: propertiesError } = await supabase
      .from("properties")
      .select("*, profiles!properties_user_id_fkey(full_name, email)")
      .gte("created_at", yesterday.toISOString())
      .is("reverse_match_processed", null) // Apenas imóveis não processados
      .order("created_at", { ascending: true })
      .limit(50);

    if (propertiesError) {
      console.error("[Reverse Match] Erro ao buscar novos imóveis:", propertiesError);
      throw propertiesError;
    }

    if (!newProperties || newProperties.length === 0) {
      console.log("[Reverse Match] Nenhum imóvel novo para processar.");
      return res.status(200).json({ 
        message: "Nenhum imóvel novo para processar",
        processed: 0 
      });
    }

    console.log(`[Reverse Match] Encontrados ${newProperties.length} imóveis novos para processar`);

    let totalNotifications = 0;

    // Processar cada imóvel
    for (const property of newProperties) {
      try {
        console.log(`[Reverse Match] Processando imóvel ${property.id}: ${property.title || 'Sem título'}`);

        // Encontrar leads com match >= 70%
        const matchedLeads = await findLeadsForProperty(
          property.id,
          property.user_id,
          70 // Score mínimo de 70%
        );

        console.log(`[Reverse Match] Encontradas ${matchedLeads.length} leads interessadas`);

        if (matchedLeads.length > 0) {
          // Criar notificação para o consultor
          const propertyTitle = property.title || `Imóvel ${property.reference_code || property.id.substring(0, 8)}`;
          const topLeads = matchedLeads.slice(0, 5); // Top 5 leads
          const leadNames = topLeads.map(m => m.lead.name).join(", ");

          const notificationData = {
            property_id: property.id,
            property_title: propertyTitle,
            matched_leads_count: matchedLeads.length,
            top_leads: topLeads.map(m => ({
              id: m.lead.id,
              name: m.lead.name,
              score: m.match_score,
              reasons: m.match_reasons,
            })),
          };

          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: property.user_id,
              notification_type: "property_match",
              title: `${matchedLeads.length} lead${matchedLeads.length > 1 ? 's' : ''} interessada${matchedLeads.length > 1 ? 's' : ''} no novo imóvel`,
              message: `O imóvel "${propertyTitle}" tem ${matchedLeads.length} lead${matchedLeads.length > 1 ? 's' : ''} com match ≥70%: ${leadNames}${matchedLeads.length > 5 ? '...' : ''}. Clique para rever e enviar sugestões.`,
              is_read: false,
              data: notificationData,
              related_entity_id: property.id,
              related_entity_type: "property",
            });

          if (notificationError) {
            console.error(`[Reverse Match] Erro ao criar notificação para imóvel ${property.id}:`, notificationError);
          } else {
            totalNotifications++;
            console.log(`[Reverse Match] Notificação criada para ${matchedLeads.length} leads do imóvel ${property.id}`);
          }
        }

        // Marcar imóvel como processado
        await supabase
          .from("properties")
          .update({ reverse_match_processed: true })
          .eq("id", property.id);

      } catch (error) {
        console.error(`[Reverse Match] Erro ao processar imóvel ${property.id}:`, error);
        // Continuar com o próximo imóvel mesmo se este falhar
      }
    }

    console.log(`[Reverse Match] Processamento concluído: ${totalNotifications} notificações criadas`);

    return res.status(200).json({
      message: "Reverse match concluído",
      properties_processed: newProperties.length,
      notifications_created: totalNotifications,
    });

  } catch (error: any) {
    console.error("[Reverse Match] Erro geral:", error);
    return res.status(500).json({ 
      error: error.message || "Erro ao processar reverse match" 
    });
  }
}