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
    // Filtrar baseado no viewMode
    if (viewMode === "day") {
      const filtered = events.filter((event) => {
        const timeValue = event.startTime || (event as any).start_time;
        if (!timeValue) return false;
        
        const eventDate = new Date(timeValue);
        return (
          eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      });
      console.log(`[Filters] Day view: ${filtered.length} eventos`);
      return filtered;
    } else if (viewMode === "week") {
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
        return eventDate >= startOfWeek && eventDate <= endOfWeek;
      });
      console.log(`[Filters] Week view: ${filtered.length} eventos`);
      return filtered;
    } else {
      const targetMonth = date.getMonth();
      const targetYear = date.getFullYear();
      
      const filtered = events.filter((event) => {
        const timeValue = event.startTime || (event as any).start_time;
        if (!timeValue) return false;
        
        const eventDate = new Date(timeValue);
        return eventDate.getMonth() === targetMonth && eventDate.getFullYear() === targetYear;
      });
      
      console.log(`[Filters] Month view (${targetYear}-${targetMonth + 1}): ${filtered.length} eventos`);
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