import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

// Helper to sync task to Google Calendar as an event
const syncTaskToGoogleCalendar = async (task: Task): Promise<string | null> => {
  try {
    // Only sync tasks with due dates
    if (!task.due_date) return null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    // Create a 1-hour event for the task
    const startTime = new Date(task.due_date);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const response = await fetch("/api/google-calendar/create-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        event: {
          summary: `📋 Tarefa: ${task.title}`,
          description: task.description || `Prioridade: ${task.priority}\nEstado: ${task.status}`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
      }),
    });

    if (!response.ok) {
      console.error("Failed to sync task to Google Calendar");
      return null;
    }

    const data = await response.json();
    return data.googleEventId;
  } catch (error) {
    console.error("Error syncing task to Google Calendar:", error);
    return null;
  }
};

// Get all tasks for current user
export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return data || [];
};

// Alias for compatibility
export const getAllTasks = getTasks;

// Get single task by ID
export const getTask = async (id: string): Promise<Task | null> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    return null;
  }

  return data;
};

// Create new task with Google Calendar sync
export const createTask = async (task: TaskInsert & { lead_id?: string | null, contact_id?: string | null }) => {
  // Map frontend IDs to database columns
  const dbTask = {
    ...task,
    related_lead_id: task.lead_id || task.related_lead_id,
    related_contact_id: task.contact_id || task.related_contact_id,
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

  // Try to sync to Google Calendar in background
  syncTaskToGoogleCalendar(data).then(async (googleEventId) => {
    if (googleEventId) {
      await supabase
        .from("tasks")
        .update({ 
          google_event_id: googleEventId,
          is_synced: true 
        })
        .eq("id", data.id);
      
      console.log("✅ Task synced to Google Calendar:", googleEventId);
    }
  }).catch(err => {
    console.error("Background sync failed:", err);
  });

  return data;
};

// Update task with Google Calendar sync
export const updateTask = async (id: string, updates: TaskUpdate) => {
  // Get current task to check if it's synced
  const { data: currentTask } = await supabase
    .from("tasks")
    .select("google_event_id, is_synced")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...updates,
      status: updates.status as any,
      priority: updates.priority as any,
      is_synced: false, // Mark as not synced until Google update succeeds
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // If task is synced to Google, update it there too
  if (currentTask?.google_event_id && data.due_date) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const startTime = new Date(data.due_date);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      fetch("/api/google-calendar/update-event", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          googleEventId: currentTask.google_event_id,
          event: {
            summary: `📋 Tarefa: ${data.title}`,
            description: data.description || `Prioridade: ${data.priority}\nEstado: ${data.status}`,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
          },
        }),
      }).then(async (response) => {
        if (response.ok) {
          await supabase
            .from("tasks")
            .update({ is_synced: true })
            .eq("id", id);
          console.log("✅ Task updated in Google Calendar");
        }
      }).catch(err => {
        console.error("Failed to update Google Calendar event:", err);
      });
    }
  }

  return data;
};

// Delete task with Google Calendar sync
export const deleteTask = async (id: string): Promise<void> => {
  // Get task to check if it's synced
  const { data: task } = await supabase
    .from("tasks")
    .select("google_event_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) throw error;

  // If task is synced to Google, delete it there too
  if (task?.google_event_id) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch("/api/google-calendar/delete-event", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          googleEventId: task.google_event_id,
        }),
      }).catch(err => {
        console.error("Failed to delete Google Calendar event:", err);
      });
    }
  }
};

// Toggle task completion
export const toggleTaskCompletion = async (id: string, currentStatus: string): Promise<Task> => {
  const newStatus = currentStatus === "completed" ? "pending" : "completed";
  
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
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
export const getTasksByStatus = async (status: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", status as any)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching tasks by status:", error);
    return [];
  }

  return data || [];
};

// Get tasks by priority
export const getTasksByPriority = async (priority: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("priority", priority as any)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching tasks by priority:", error);
    return [];
  }

  return data || [];
};

// Get overdue tasks
export const getOverdueTasks = async (): Promise<Task[]> => {
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

  return data || [];
};