import { NextApiRequest, NextApiResponse } from "next";
import { validateGptRequest, logGptAction } from "@/lib/gptAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCalendarEventSignature } from "@/lib/calendarEventDedup";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await validateGptRequest(req, res);
  if (!userId) return;

  if (req.method === "GET") {
    try {
      const { start_date, end_date } = req.query;
      
      let query = supabaseAdmin
        .from("calendar_events")
        .select("id, title, description, start_time, end_time, event_type, lead_id, location")
        .eq("user_id", userId);

      if (start_date) query = query.gte("start_time", start_date as string);
      if (end_date) query = query.lte("start_time", end_date as string);

      const { data: events, error } = await query.order("start_time", { ascending: true });

      if (error) throw error;

      await logGptAction(userId, "gpt_read_calendar", "calendar_events", null, { start_date, end_date });

      return res.status(200).json({ events });
    } catch (error: any) {
      console.error("GPT API Error:", error);
      return res.status(500).json({ error: error.message });
    }
  } else if (req.method === "POST") {
    try {
      const { title, description, start_time, end_time, event_type, lead_id, location } = req.body;

      if (!title || !start_time || !end_time) {
        return res.status(400).json({ error: "Missing required fields (title, start_time, end_time)" });
      }

      const parsedStartTime = new Date(start_time);
      const parsedEndTime = new Date(end_time);

      if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
        return res.status(400).json({ error: "Invalid start_time or end_time" });
      }

      if (parsedEndTime <= parsedStartTime) {
        return res.status(400).json({ error: "end_time must be after start_time" });
      }

      const normalizedStartTime = parsedStartTime.toISOString();
      const normalizedEndTime = parsedEndTime.toISOString();

      const { data: candidateMatches, error: duplicateError } = await (
        lead_id
          ? supabaseAdmin
              .from("calendar_events")
              .select("id, title, description, start_time, end_time, event_type, lead_id, location")
              .eq("user_id", userId)
              .eq("lead_id", lead_id)
              .eq("start_time", normalizedStartTime)
              .eq("end_time", normalizedEndTime)
          : supabaseAdmin
              .from("calendar_events")
              .select("id, title, description, start_time, end_time, event_type, lead_id, location")
              .eq("user_id", userId)
              .is("lead_id", null)
              .eq("start_time", normalizedStartTime)
              .eq("end_time", normalizedEndTime)
      );

      if (duplicateError) {
        throw duplicateError;
      }

      const incomingSignature = buildCalendarEventSignature({
        title,
        lead_id: lead_id || null,
        start_time: normalizedStartTime,
        end_time: normalizedEndTime,
      });

      const existingEvent = (candidateMatches || []).find((event) => (
        buildCalendarEventSignature(event) === incomingSignature
      ));

      if (existingEvent) {
        await logGptAction(userId, "gpt_create_event_skipped_duplicate", "calendar_events", existingEvent.id, {
          title,
          start_time: normalizedStartTime,
          lead_id: lead_id || null,
        });

        return res.status(200).json({
          event: existingEvent,
          duplicate: true,
          message: "Event already exists for this lead and time",
        });
      }

      const newEvent = {
        user_id: userId,
        title,
        description: description || null,
        start_time: normalizedStartTime,
        end_time: normalizedEndTime,
        event_type: event_type || "meeting",
        lead_id: lead_id || null,
        location: location || null
      };

      const { data: event, error } = await supabaseAdmin
        .from("calendar_events")
        .insert(newEvent)
        .select()
        .single();

      if (error) throw error;

      await logGptAction(userId, "gpt_create_event", "calendar_events", event.id, { title, start_time });

      return res.status(201).json({ event, message: "Event scheduled successfully" });
    } catch (error: any) {
      console.error("GPT API Error:", error);
      return res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}