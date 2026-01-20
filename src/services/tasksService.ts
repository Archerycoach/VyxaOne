import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Task as GlobalTask } from "@/types";
import { syncTaskToGoogle, deleteGoogleCalendarEvent } from "@/lib/googleCalendar";

type DbTask = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

// Helper to map DB task to Global Task
const mapDbTaskToGlobal = (task: any): GlobalTask => {
  // Extract lead name from nested leads object or from direct property
  const leadName = task.relatedLeadName || task.leads?.name || null;
  
  console.log("[mapDbTaskToGlobal] Mapping task:", {
    id: task.id,
    related_lead_id: task.related_lead_id,
    leadName: leadName,
    rawLeads: task.leads,
  });
  
  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    notes: task.notes || "",
    leadId: task.related_lead_id || undefined,
    relatedLeadId: task.related_lead_id || undefined,
    relatedLeadName: leadName,
    propertyId: task.related_property_id || undefined,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date || "",
    assignedTo: task.assigned_to || "",
    completed: task.status === 'completed',
    createdAt: task.created_at,
    googleEventId: task.google_event_id,
    isSynced: task.is_synced,
  };
};

// Get all tasks for current user
export const getTasks = async (): Promise<GlobalTask[]> => {
  console.log("[tasksService] ==================== GET TASKS ====================");
  
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      leads:related_lead_id (
        id,
        name
      )
    `)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("[tasksService] Error fetching tasks:", error);
    return [];
  }

  console.log("[tasksService] Raw data from Supabase:", data);
  console.log("[tasksService] Total tasks:", data?.length || 0);

  // Map database tasks to GlobalTask format
  const mappedTasks = (data || []).map((task: any) => {
    console.log("[tasksService] --- Processing task ---");
    console.log("[tasksService] Task ID:", task.id);
    console.log("[tasksService] Task title:", task.title);
    console.log("[tasksService] related_lead_id:", task.related_lead_id);
    console.log("[tasksService] leads object:", task.leads);
    console.log("[tasksService] leads.name:", task.leads?.name);
    
    const leadName = task.leads?.name || null;
    const mappedTask = mapDbTaskToGlobal({
      ...task,
      relatedLeadName: leadName,
    });
    
    console.log("[tasksService] Mapped task:", {
      id: mappedTask.id,
      title: mappedTask.title,
      relatedLeadId: mappedTask.relatedLeadId,
      relatedLeadName: mappedTask.relatedLeadName,
      rawLeadData: task.leads,
    });
    
    return mappedTask;
  });

  console.log("[tasksService] All mapped tasks:", mappedTasks);
  console.log("[tasksService] Tasks with lead data:", mappedTasks.filter(t => t.relatedLeadName).length);
  console.log("[tasksService] ================================================================");

  return mappedTasks;
};

// Alias for compatibility
export const getAllTasks = getTasks;

// Get single task by ID
export const getTask = async (id: string): Promise<GlobalTask | null> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    return null;
  }

  return mapDbTaskToGlobal(data);
};

// Create new task with Google Calendar sync
export const createTask = async (task: TaskInsert & { lead_id?: string | null, contact_id?: string | null }) => {
  // Get current user ID if not provided or empty
  let userId = task.user_id;
  if (!userId || userId === "") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }
    userId = user.id;
  }

  // Map frontend IDs to database columns
  // Convert empty strings to null to prevent UUID errors
  const dbTask = {
    ...task,
    user_id: userId,
    related_lead_id: (task.lead_id && task.lead_id !== "" ? task.lead_id : task.related_lead_id) || null,
    related_contact_id: (task.contact_id && task.contact_id !== "" ? task.contact_id : task.related_contact_id) || null,
    assigned_to: task.assigned_to || null,
    status: task.status as any,
    priority: task.priority as any,
    is_synced: false,
  };
  
  // Remove frontend-only properties if they exist
  delete (dbTask as any).lead_id;
  delete (dbTask as any).contact_id;

  const { data, error } = await supabase
    .from("tasks")
    .insert(dbTask)
    .select()
    .single();

  if (error) throw error;

  // Sync to Google Calendar if task has a due date
  if (data && data.due_date) {
    console.log("[createTask] Syncing new task to Google Calendar...");
    const googleEventId = await syncTaskToGoogle({
      title: data.title,
      description: data.description || "",
      due_date: data.due_date,
      priority: data.priority,
    }, null);

    if (googleEventId) {
      console.log("[createTask] Task synced to Google, updating local record...");
      await supabase
        .from("tasks")
        .update({ 
          google_event_id: googleEventId,
          is_synced: true 
        })
        .eq("id", data.id);
      
      // Update the returned data
      data.google_event_id = googleEventId;
      data.is_synced = true;
    }
  }

  return mapDbTaskToGlobal(data);
};

// Update task with Google Calendar sync
export const updateTask = async (id: string, updates: TaskUpdate) => {
  // Get current task to check if it's synced
  const { data: currentTask } = await supabase
    .from("tasks")
    .select("google_event_id, is_synced, due_date, title, description, priority")
    .eq("id", id)
    .single();

  // ✅ NEW APPROACH: Do UPDATE without SELECT to avoid 406 error
  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      ...updates,
      status: updates.status as any,
      priority: updates.priority as any,
      is_synced: false,
    })
    .eq("id", id);

  if (updateError) throw updateError;

  // ✅ Then fetch the updated task separately
  const { data, error: selectError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (selectError) throw selectError;

  // Sync to Google Calendar if task has a due date and was previously synced
  if (data && data.due_date && currentTask?.google_event_id) {
    console.log("[updateTask] Syncing updated task to Google Calendar...");
    const googleEventId = await syncTaskToGoogle({
      title: data.title,
      description: data.description || "",
      due_date: data.due_date,
      priority: data.priority,
    }, currentTask.google_event_id);

    if (googleEventId) {
      console.log("[updateTask] Task synced to Google");
      await supabase
        .from("tasks")
        .update({ is_synced: true })
        .eq("id", id);
      
      data.is_synced = true;
    }
  } else if (data && data.due_date && !currentTask?.google_event_id) {
    // Task wasn't synced before but now has a due date - create in Google
    console.log("[updateTask] Creating task in Google Calendar for first time...");
    const googleEventId = await syncTaskToGoogle({
      title: data.title,
      description: data.description || "",
      due_date: data.due_date,
      priority: data.priority,
    }, null);

    if (googleEventId) {
      console.log("[updateTask] Task created in Google");
      await supabase
        .from("tasks")
        .update({ 
          google_event_id: googleEventId,
          is_synced: true 
        })
        .eq("id", id);
      
      data.google_event_id = googleEventId;
      data.is_synced = true;
    }
  }

  return mapDbTaskToGlobal(data);
};

// Delete task with Google Calendar sync
export const deleteTask = async (id: string): Promise<void> => {
  console.log("🔴 deleteTask called for id:", id);
  
  // First, get the task to check if it has a Google event ID
  const { data: task } = await supabase
    .from("tasks")
    .select("google_event_id")
    .eq("id", id)
    .single();

  // Delete from Google Calendar if synced
  if (task?.google_event_id) {
    console.log("🔴 Task has Google event ID, deleting from Google Calendar...");
    await deleteGoogleCalendarEvent(task.google_event_id);
  }
  
  // First, let's check if the task exists and belongs to current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log("🔴 Current user ID:", user?.id);
  
  const { data: taskCheck, error: checkError } = await supabase
    .from("tasks")
    .select("id, user_id, title")
    .eq("id", id)
    .single();
  
  if (checkError) {
    console.error("🔴 Error checking task:", checkError);
  } else {
    console.log("🔴 Task found:", taskCheck);
    console.log("🔴 Task user_id:", taskCheck?.user_id);
    console.log("🔴 Match?", taskCheck?.user_id === user?.id);
  }

  // Delete the task
  const { data: deleteData, error, count } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .select();

  console.log("🔴 Delete response:", { data: deleteData, error, count });

  if (error) {
    console.error("🔴 Delete error details:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw error;
  }

  if (!deleteData || deleteData.length === 0) {
    console.error("🔴 NO ROWS DELETED! Task might not exist or RLS is blocking.");
    throw new Error("Failed to delete task - no rows affected. Check RLS policies.");
  }

  console.log("🔴 Task successfully deleted:", deleteData);
};

// Toggle task completion
export const toggleTaskCompletion = async (id: string, currentStatus: string): Promise<GlobalTask> => {
  const newStatus = currentStatus === "completed" ? "pending" : "completed";
  
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapDbTaskToGlobal(data);
};

export const completeTask = async (id: string) => {
  return updateTask(id, { status: "completed" });
};

export const getTaskStats = async () => {
  const { data: tasks } = await supabase.from("tasks").select("status, due_date");
  
  if (!tasks) return { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 };
  
  const now = new Date();
  
  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    overdue: tasks.filter(t => t.status !== "completed" && t.due_date && new Date(t.due_date) < now).length
  };
};

// Get tasks by status
export const getTasksByStatus = async (status: string): Promise<GlobalTask[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", status as any)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching tasks by status:", error);
    return [];
  }

  return (data || []).map(mapDbTaskToGlobal);
};

// Get tasks by priority
export const getTasksByPriority = async (priority: string): Promise<GlobalTask[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("priority", priority as any)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching tasks by priority:", error);
    return [];
  }

  return (data || []).map(mapDbTaskToGlobal);
};

// Get overdue tasks
export const getOverdueTasks = async (): Promise<GlobalTask[]> => {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .neq("status", "completed")
    .lt("due_date", now)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching overdue tasks:", error);
    return [];
  }

  return (data || []).map(mapDbTaskToGlobal);
};

// Manual sync function that uses the existing /api/google-calendar/sync endpoint
export const manualSync = async () => {
  const { data, error } = await supabase.functions.invoke("google-calendar-sync");

  if (error) {
    console.error("Error during manual sync:", error);
    throw error;
  }

  return data;
};

// Get tasks by lead ID
export const getTasksByLead = async (leadId: string): Promise<GlobalTask[]> => {
  console.log("[tasksService] Fetching tasks for lead:", leadId);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("[tasksService] User not authenticated");
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("related_lead_id", leadId)
    .order("due_date", { ascending: false });

  if (error) {
    console.error("[tasksService] Error fetching tasks by lead:", error);
    return [];
  }

  console.log("[tasksService] Found tasks for lead:", data?.length || 0);
  return (data || []).map(mapDbTaskToGlobal);
};