import { useState, useMemo } from "react";
import type { CalendarEvent, Task } from "@/types";

export type ViewMode = "month" | "week" | "day";

export function useCalendarFilters() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const filterEventsByDate = (events: CalendarEvent[], date: Date) => {
    console.log("[useCalendarFilters] ===== FILTER DEBUG START =====");
    console.log("[useCalendarFilters] Total events to filter:", events.length);
    console.log("[useCalendarFilters] Target date:", date.toISOString());
    console.log("[useCalendarFilters] View mode:", viewMode);
    
    // Log sample events WITH FULL STRUCTURE
    if (events.length > 0) {
      console.log("[useCalendarFilters] Sample event FULL STRUCTURE:", events[0]);
      console.log("[useCalendarFilters] Sample events:", events.slice(0, 3).map(e => ({
        title: e.title,
        startTime: e.startTime,
        start_time: (e as any).start_time,
        date: e.startTime ? new Date(e.startTime).toLocaleDateString() : 'NO START TIME'
      })));
    }

    // Filtrar baseado no viewMode
    if (viewMode === "day") {
      // Day view: apenas eventos do dia exato
      const filtered = events.filter((event) => {
        // Try both camelCase and snake_case
        const timeValue = event.startTime || (event as any).start_time;
        if (!timeValue) {
          console.log("[useCalendarFilters] ⚠️ Event without time:", event.title);
          return false;
        }
        
        const eventDate = new Date(timeValue);
        const match = (
          eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
        
        if (match) {
          console.log("[useCalendarFilters] Day match:", event.title);
        }
        
        return match;
      });
      console.log("[useCalendarFilters] Day view filtered:", filtered.length);
      return filtered;
    } else if (viewMode === "week") {
      // Week view: eventos da semana (domingo a sábado)
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const filtered = events.filter((event) => {
        const timeValue = event.startTime || (event as any).start_time;
        if (!timeValue) return false;
        
        const eventDate = new Date(timeValue);
        const match = eventDate >= startOfWeek && eventDate <= endOfWeek;
        
        if (match) {
          console.log("[useCalendarFilters] Week match:", event.title);
        }
        
        return match;
      });
      console.log("[useCalendarFilters] Week view filtered:", {
        startOfWeek: startOfWeek.toISOString(),
        endOfWeek: endOfWeek.toISOString(),
        filtered: filtered.length
      });
      return filtered;
    } else {
      // Month view: eventos do mês inteiro
      const targetMonth = date.getMonth();
      const targetYear = date.getFullYear();
      
      const filtered = events.filter((event) => {
        const timeValue = event.startTime || (event as any).start_time;
        if (!timeValue) {
          console.log("[useCalendarFilters] ⚠️ Event without time in month view:", event.title);
          return false;
        }
        
        const eventDate = new Date(timeValue);
        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        const match = eventMonth === targetMonth && eventYear === targetYear;
        
        if (!match && eventYear === targetYear && Math.abs(eventMonth - targetMonth) <= 1) {
          console.log("[useCalendarFilters] ⚠️ Event close but outside target month:", {
            title: event.title,
            eventDate: eventDate.toISOString(),
            eventMonth,
            targetMonth,
            timeValue
          });
        }
        
        if (match) {
          console.log("[useCalendarFilters] Month match:", event.title);
        }
        
        return match;
      });
      
      console.log("[useCalendarFilters] Month view filtered:", {
        targetMonth,
        targetYear,
        filtered: filtered.length
      });
      
      if (filtered.length > 0) {
        console.log("[useCalendarFilters] Filtered events sample:", filtered.slice(0, 3).map(e => ({
          title: e.title,
          startTime: e.startTime
        })));
      }
      
      console.log("[useCalendarFilters] ===== FILTER DEBUG END =====");
      return filtered;
    }
  };

  const filterTasksByDate = (tasks: Task[], date: Date) => {
    // Filtrar baseado no viewMode
    if (viewMode === "day") {
      // Day view: apenas tarefas do dia exato
      return tasks.filter((task) => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return (
          taskDate.getDate() === date.getDate() &&
          taskDate.getMonth() === date.getMonth() &&
          taskDate.getFullYear() === date.getFullYear()
        );
      });
    } else if (viewMode === "week") {
      // Week view: tarefas da semana
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      return tasks.filter((task) => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return taskDate >= startOfWeek && taskDate <= endOfWeek;
      });
    } else {
      // Month view: tarefas do mês inteiro
      return tasks.filter((task) => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return (
          taskDate.getMonth() === date.getMonth() &&
          taskDate.getFullYear() === date.getFullYear()
        );
      });
    }
  };

  return {
    currentDate,
    viewMode,
    showTasks,
    showEvents,
    setViewMode,
    setShowTasks,
    setShowEvents,
    navigateDate,
    goToToday,
    filterEventsByDate,
    filterTasksByDate,
  };
}