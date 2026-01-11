import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WorkflowRule = Database["public"]["Tables"]["lead_workflow_rules"]["Row"];
type WorkflowRuleInsert = Database["public"]["Tables"]["lead_workflow_rules"]["Insert"];

export const getWorkflowRules = async () => {
  const { data, error } = await supabase
    .from("lead_workflow_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workflow rules:", error);
    return [];
  }

  return data;
};

export const createWorkflowRule = async (rule: any) => {
  const { data, error } = await supabase
    .from("lead_workflow_rules")
    .insert(rule as any) // Force cast
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateWorkflowRule = async (id: string, updates: Partial<WorkflowRuleInsert>) => {
  const { data, error } = await supabase
    .from("lead_workflow_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating workflow rule:", error);
    throw error;
  }

  return data;
};

export const deleteWorkflowRule = async (id: string) => {
  const { error } = await supabase
    .from("lead_workflow_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting workflow rule:", error);
    throw error;
  }

  return true;
};

export const processLeadWorkflows = async (leadId: string, triggerType: string) => {
  // Placeholder implementation for workflow processing
  // In a real implementation, this would:
  // 1. Fetch active workflow rules for this trigger type
  // 2. Evaluate conditions against the lead
  // 3. Execute actions (send email, create task, etc.)
  
  console.log(`Processing workflows for lead ${leadId} with trigger ${triggerType}`);
  return true;
};

export const executeWorkflowForLead = async (
  workflowId: string, 
  leadId: string, 
  userId: string
) => {
  const { data: workflow, error: workflowError } = await supabase
    .from("lead_workflow_rules")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (workflowError || !workflow) {
    throw new Error("Workflow não encontrado");
  }

  // Create execution record
  const { data: execution, error: executionError } = await supabase
    .from("workflow_executions")
    .insert({
      workflow_id: workflowId,
      lead_id: leadId,
      user_id: userId,
      status: "pending",
      executed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (executionError) {
    throw executionError;
  }

  // Simulate workflow processing
  // In a real implementation, this would:
  // 1. Send emails via email service
  // 2. Create tasks in task table
  // 3. Send notifications via notification service
  // 4. Create calendar events

  try {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update execution status to completed
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", execution.id);

    return execution;
  } catch (error) {
    // Update execution status to failed
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString()
      })
      .eq("id", execution.id);

    throw error;
  }
};