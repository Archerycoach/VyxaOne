import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { executeWorkflowAction } from "@/services/workflowService";

/**
 * Cron Job: WhatsApp Cadence Processor
 * 
 * Processa cadências ativas de workflows (sequências multi-passo):
 * - Executa passos agendados para hoje
 * - Verifica se lead respondeu (para cadência se stop_on_response=true)
 * - Agenda próximo passo baseado no delay configurado
 * 
 * Executa de hora em hora para processamento em tempo quasi-real.
 */

interface CadenceToProcess {
  id: string;
  workflow_id: string;
  lead_id: string;
  user_id: string;
  current_step: number;
  started_at: string;
  last_executed_at?: string;
  workflow: {
    id: string;
    name: string;
    steps: any[];
    stop_on_response: boolean;
  };
  lead: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    user_id: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authorization
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Cadence Processor] Starting at", new Date().toISOString());

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = {
    processed: 0,
    executed: 0,
    stopped: 0,
    completed: 0,
    errors: 0,
  };

  try {
    // Buscar cadências ativas com próximo passo agendado para agora ou antes
    const { data: cadences, error } = await supabaseAdmin
      .from("workflow_cadences")
      .select(`
        id,
        workflow_id,
        lead_id,
        user_id,
        current_step,
        started_at,
        last_executed_at,
        workflow:lead_workflow_rules!workflow_id (
          id,
          name,
          steps,
          stop_on_response
        ),
        lead:leads!lead_id (
          id,
          name,
          email,
          phone,
          user_id
        )
      `)
      .eq("status", "active")
      .lte("next_execution_date", new Date().toISOString())
      .limit(100);

    if (error) throw error;

    console.log(`[Cadence Processor] Found ${cadences?.length || 0} cadences to process`);

    for (const cadence of ((cadences || []) as any)) {
      try {
        await processCadence(cadence, supabaseAdmin, results);
      } catch (error: any) {
        console.error(`[Cadence Processor] Error processing cadence ${cadence.id}:`, error);
        results.errors++;
      }
      results.processed++;
    }

    console.log("[Cadence Processor] Completed:", results);

    return res.status(200).json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[Cadence Processor] Fatal error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      results,
    });
  }
}

/**
 * Processa uma cadência individual
 */
async function processCadence(
  cadence: CadenceToProcess,
  supabaseAdmin: any,
  results: any
): Promise<void> {
  const workflow = Array.isArray(cadence.workflow) ? cadence.workflow[0] : cadence.workflow;
  const lead = Array.isArray(cadence.lead) ? cadence.lead[0] : cadence.lead;
  
  if (!workflow || !lead) {
    console.error(`[Cadence] Missing workflow or lead data for cadence ${cadence.id}`);
    return;
  }

  const steps = workflow.steps || [];
  const currentStepIndex = cadence.current_step;

  // Verificar se cadência já completou todos os passos
  if (currentStepIndex >= steps.length) {
    await supabaseAdmin
      .from("workflow_cadences")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", cadence.id);

    results.completed++;
    console.log(`[Cadence] Completed cadence ${cadence.id} - all steps executed`);
    return;
  }

  // Verificar se lead respondeu (se stop_on_response=true)
  if (workflow.stop_on_response) {
    const hasResponded = await checkIfLeadResponded(
      lead.id,
      cadence.last_executed_at || cadence.started_at,
      supabaseAdmin
    );

    if (hasResponded) {
      await supabaseAdmin
        .from("workflow_cadences")
        .update({
          status: "stopped",
          stopped_reason: "Lead respondeu - cadência interrompida",
          completed_at: new Date().toISOString(),
        })
        .eq("id", cadence.id);

      // Criar notificação para o consultor
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: cadence.user_id,
          title: `Cadência parada: ${lead.name} respondeu`,
          message: `A cadência "${workflow.name}" foi automaticamente interrompida porque o lead respondeu.`,
          notification_type: "success",
          related_entity_type: "lead",
          related_entity_id: lead.id,
        });

      results.stopped++;
      console.log(`[Cadence] Stopped cadence ${cadence.id} - lead responded`);
      return;
    }
  }

  // Executar passo atual
  const currentStep = steps[currentStepIndex];
  
  try {
    console.log(`[Cadence] Executing step ${currentStepIndex} of cadence ${cadence.id}:`, currentStep);

    // Executar ação do passo
    await executeWorkflowAction(currentStep, lead, cadence.user_id);

    // Registar execução do passo
    await supabaseAdmin
      .from("workflow_step_executions")
      .insert({
        cadence_id: cadence.id,
        step_index: currentStepIndex,
        action_type: currentStep.action_type || currentStep.type,
        action_config: currentStep.config || currentStep,
        status: "completed",
        executed_at: new Date().toISOString(),
      });

    results.executed++;

    // Calcular próximo passo e data de execução
    const nextStepIndex = currentStepIndex + 1;
    let nextExecutionDate = null;

    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];
      const delayDays = nextStep.delay_days || 0;
      
      nextExecutionDate = new Date();
      nextExecutionDate.setDate(nextExecutionDate.getDate() + delayDays);
    }

    // Atualizar cadência
    await supabaseAdmin
      .from("workflow_cadences")
      .update({
        current_step: nextStepIndex,
        last_executed_at: new Date().toISOString(),
        next_execution_date: nextExecutionDate?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cadence.id);

    console.log(`[Cadence] Step ${currentStepIndex} executed. Next step: ${nextStepIndex} at ${nextExecutionDate?.toISOString() || 'completed'}`);

  } catch (error: any) {
    console.error(`[Cadence] Failed to execute step ${currentStepIndex}:`, error);

    // Registar falha
    await supabaseAdmin
      .from("workflow_step_executions")
      .insert({
        cadence_id: cadence.id,
        step_index: currentStepIndex,
        action_type: currentStep.action_type || currentStep.type,
        action_config: currentStep.config || currentStep,
        status: "failed",
        error_message: error.message,
        executed_at: new Date().toISOString(),
      });

    throw error;
  }
}

/**
 * Verifica se lead respondeu desde a última execução
 */
async function checkIfLeadResponded(
  leadId: string,
  since: string,
  supabaseAdmin: any
): Promise<boolean> {
  // Verificar interações inbound (email_inbound, whatsapp_inbound, call, visit)
  const { data: interactions, error } = await supabaseAdmin
    .from("interactions")
    .select("id")
    .eq("lead_id", leadId)
    .in("interaction_type", ["email_inbound", "whatsapp_inbound", "call", "visit"])
    .gte("created_at", since)
    .limit(1);

  if (error) {
    console.error("[Cadence] Error checking lead response:", error);
    return false;
  }

  return (interactions?.length || 0) > 0;
}