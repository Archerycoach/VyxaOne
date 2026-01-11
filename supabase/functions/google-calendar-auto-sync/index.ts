import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configurações para reduzir uso de memória
const BATCH_SIZE = 5; // Processar apenas 5 utilizadores de cada vez
const MAX_EVENTS_PER_SYNC = 50; // Limitar eventos por sincronização
const REQUEST_TIMEOUT = 30000; // 30 segundos timeout

interface GoogleCalendarIntegration {
  id: string;
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  sync_events: boolean;
  sync_tasks: boolean;
  sync_direction: string;
  auto_sync: boolean;
  calendar_id: string | null;
}

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Timeout para toda a função
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Function timeout")), REQUEST_TIMEOUT);
    });

    const mainPromise = processSync();
    const result = await Promise.race([mainPromise, timeoutPromise]);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-sync:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        duration_ms: Date.now() - startTime 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processSync() {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Buscar apenas os primeiros N utilizadores para processar
  const { data: integrations, error: integrationsError } = await supabaseClient
    .from("google_calendar_integrations")
    .select("id, user_id, google_email, access_token, refresh_token, expires_at, sync_events, sync_tasks, sync_direction, auto_sync, calendar_id")
    .eq("auto_sync", true)
    .limit(BATCH_SIZE);

  if (integrationsError) {
    throw integrationsError;
  }

  if (!integrations || integrations.length === 0) {
    return { 
      message: "No active integrations found", 
      synced: 0,
      processed: 0 
    };
  }

  let totalSynced = 0;
  const results = [];

  // Processar um utilizador de cada vez (sequencial)
  for (const integration of integrations as unknown as GoogleCalendarIntegration[]) {
    try {
      const syncResult = await syncUserData(supabaseClient, integration);
      totalSynced += syncResult.count;
      results.push({ 
        user_id: integration.user_id, 
        synced: syncResult.count,
        details: syncResult.details
      });
    } catch (error) {
      console.error(`Error syncing user ${integration.user_id}:`, error);
      results.push({ 
        user_id: integration.user_id, 
        error: error.message 
      });
    }
  }

  return { 
    message: "Auto-sync completed", 
    total_synced: totalSynced,
    processed: integrations.length,
    results 
  };
}

async function syncUserData(
  supabase: any,
  integration: GoogleCalendarIntegration
): Promise<{ count: number; details: any }> {
  // Verificar e renovar token se necessário
  const accessToken = await ensureValidToken(supabase, integration);
  
  let syncedCount = 0;
  const details: any = {};

  // Sync events to Google
  if (integration.sync_events && 
      (integration.sync_direction === "both" || integration.sync_direction === "toGoogle")) {
    const eventsCount = await syncEventsToGoogle(
      supabase,
      integration.user_id,
      accessToken,
      integration.calendar_id || "primary"
    );
    syncedCount += eventsCount;
    details.events_to_google = eventsCount;
  }

  // Sync tasks to Google
  if (integration.sync_tasks && 
      (integration.sync_direction === "both" || integration.sync_direction === "toGoogle")) {
    const tasksCount = await syncTasksToGoogle(
      supabase,
      integration.user_id,
      accessToken,
      integration.calendar_id || "primary"
    );
    syncedCount += tasksCount;
    details.tasks_to_google = tasksCount;
  }

  // Sync events from Google
  if (integration.sync_direction === "both" || integration.sync_direction === "fromGoogle") {
    const fromGoogleCount = await syncEventsFromGoogle(
      supabase,
      integration.user_id,
      accessToken,
      integration.calendar_id || "primary"
    );
    syncedCount += fromGoogleCount;
    details.events_from_google = fromGoogleCount;
  }

  // Update last sync timestamp
  await supabase
    .from("google_calendar_integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integration.id);

  return { count: syncedCount, details };
}

async function ensureValidToken(
  supabase: any,
  integration: GoogleCalendarIntegration
): Promise<string> {
  const isExpired = new Date(integration.expires_at).getTime() <= Date.now();
  
  if (!isExpired) {
    return integration.access_token;
  }

  if (!integration.refresh_token) {
    throw new Error("Token expired and no refresh token available");
  }

  // Get OAuth settings
  const { data: settings, error: settingsError } = await supabase
    .from("integration_settings")
    .select("client_id, client_secret")
    .eq("service_name", "google_calendar")
    .single();

  if (settingsError || !settings) {
    throw new Error("OAuth settings not found");
  }

  // Refresh access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.client_id,
      client_secret: settings.client_secret,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Token refresh failed");
  }

  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update tokens
  await supabase
    .from("google_calendar_integrations")
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", integration.id);

  return tokens.access_token;
}

async function syncEventsToGoogle(
  supabase: any,
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    // Buscar apenas eventos recentes sem google_event_id
    const { data: events, error } = await supabase
      .from("calendar_events")
      .select("id, title, description, start_time, end_time")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(MAX_EVENTS_PER_SYNC);

    if (error || !events || events.length === 0) {
      return 0;
    }

    let syncedCount = 0;

    for (const event of events) {
      try {
        const googleEvent: GoogleCalendarEvent = {
          summary: event.title,
          description: event.description || "",
          start: {
            dateTime: event.start_time,
            timeZone: "Europe/Lisbon",
          },
          end: {
            dateTime: event.end_time,
            timeZone: "Europe/Lisbon",
          },
        };

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (!response.ok) {
          console.error(`Failed to sync event ${event.id}:`, await response.text());
          continue;
        }

        const createdEvent = await response.json();

        await supabase
          .from("calendar_events")
          .update({ google_event_id: createdEvent.id })
          .eq("id", event.id);

        syncedCount++;
      } catch (eventError) {
        console.error(`Error syncing event ${event.id}:`, eventError);
      }
    }

    return syncedCount;
  } catch (error) {
    console.error("Error in syncEventsToGoogle:", error);
    return 0;
  }
}

async function syncTasksToGoogle(
  supabase: any,
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    // Buscar apenas tarefas recentes sem google_event_id
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, title, description, due_date")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .not("due_date", "is", null)
      .gte("due_date", new Date().toISOString())
      .order("due_date", { ascending: true })
      .limit(MAX_EVENTS_PER_SYNC);

    if (error || !tasks || tasks.length === 0) {
      return 0;
    }

    let syncedCount = 0;

    for (const task of tasks) {
      try {
        const dueDate = new Date(task.due_date);
        const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

        const googleEvent: GoogleCalendarEvent = {
          summary: `[Tarefa] ${task.title}`,
          description: task.description || "",
          start: {
            dateTime: dueDate.toISOString(),
            timeZone: "Europe/Lisbon",
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: "Europe/Lisbon",
          },
        };

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (!response.ok) {
          console.error(`Failed to sync task ${task.id}:`, await response.text());
          continue;
        }

        const createdEvent = await response.json();

        await supabase
          .from("tasks")
          .update({ google_event_id: createdEvent.id })
          .eq("id", task.id);

        syncedCount++;
      } catch (taskError) {
        console.error(`Error syncing task ${task.id}:`, taskError);
      }
    }

    return syncedCount;
  } catch (error) {
    console.error("Error in syncTasksToGoogle:", error);
    return 0;
  }
}

async function syncEventsFromGoogle(
  supabase: any,
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    const timeMin = new Date().toISOString();
    
    // Limitar resultados da API do Google
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=${MAX_EVENTS_PER_SYNC}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch Google events:", await response.text());
      return 0;
    }

    const data = await response.json();
    const googleEvents = data.items || [];

    let syncedCount = 0;

    for (const googleEvent of googleEvents) {
      try {
        if (!googleEvent.start?.dateTime) continue;

        // Verificar se já existe
        const { data: existingEvent } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("google_event_id", googleEvent.id)
          .maybeSingle();

        if (existingEvent) continue;

        // Criar novo evento
        const { error: createError } = await supabase
          .from("calendar_events")
          .insert({
            user_id: userId,
            title: googleEvent.summary || "Sem título",
            description: googleEvent.description || "",
            start_time: googleEvent.start.dateTime,
            end_time: googleEvent.end.dateTime,
            google_event_id: googleEvent.id,
          });

        if (!createError) {
          syncedCount++;
        }
      } catch (eventError) {
        console.error(`Error importing event ${googleEvent.id}:`, eventError);
      }
    }

    return syncedCount;
  } catch (error) {
    console.error("Error in syncEventsFromGoogle:", error);
    return 0;
  }
}