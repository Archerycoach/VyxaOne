import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "./EventCard";
import { TaskCard } from "./TaskCard";
import type { CalendarEvent, Task } from "@/types";
import type { InteractionWithDetails } from "@/services/interactionsService";
import type { CalendarNote } from "../hooks/useCalendarNotes";

interface CalendarGridProps {
  viewMode: "day" | "week" | "month";
  currentDate: Date;
  events: CalendarEvent[];
  tasks: Task[];
  interactions: InteractionWithDetails[];
  notes: CalendarNote[];
  onEventClick: (event: CalendarEvent) => void;
  onTaskClick: (task: Task) => void;
  onDeleteEvent?: (eventId: string) => void;
  // Drag and Drop handlers
  onDragStart: (e: React.DragEvent, item: { id: string; type: "event" | "task"; startTime: string }) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
}

export function CalendarGrid({
  viewMode,
  currentDate,
  events,
  tasks,
  interactions,
  notes,
  onEventClick,
  onTaskClick,
  onDeleteEvent,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: CalendarGridProps) {
  // Debug: Log dos eventos recebidos
  console.log("[CalendarGrid] ===== DEBUG START =====");
  console.log("[CalendarGrid] Events received:", events.length);
  console.log("[CalendarGrid] Current date:", currentDate.toISOString());
  console.log("[CalendarGrid] View mode:", viewMode);
  
  if (events.length > 0) {
    console.log("[CalendarGrid] First 3 events structure:", events.slice(0, 3).map(e => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      startTimeType: typeof e.startTime,
      googleEventId: e.googleEventId,
      userId: e.userId
    })));
  }

  const getEventsForDay = (day: Date) => {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    
    const filtered = events.filter(event => {
      const eventDate = new Date(event.startTime);
      const isInRange = eventDate >= startOfDay && eventDate <= endOfDay;
      
      if (isInRange) {
        console.log(`[CalendarGrid] ✅ Event matches ${day.toLocaleDateString()}:`, {
          title: event.title,
          startTime: event.startTime,
          eventDate: eventDate.toISOString()
        });
      }
      
      return isInRange;
    });

    console.log(`[CalendarGrid] Events for ${day.toLocaleDateString()}:`, filtered.length);
    
    return filtered;
  };

  const getTasksForDay = (day: Date) => {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return taskDate >= startOfDay && taskDate <= endOfDay;
    });
  };

  const getInteractionsForDay = (day: Date) => {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    
    return interactions.filter(interaction => {
      if (!interaction.interaction_date) return false;
      const interactionDate = new Date(interaction.interaction_date);
      return interactionDate >= startOfDay && interactionDate <= endOfDay;
    });
  };

  const getNotesForDay = (day: Date) => {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    
    return notes.filter(note => {
      const noteDate = new Date(note.created_at);
      return noteDate >= startOfDay && noteDate <= endOfDay;
    });
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return day;
    });
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const days = [];
    const currentDay = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  };

  // Day View
  if (viewMode === "day") {
    const dayEvents = getEventsForDay(currentDate);
    const dayTasks = getTasksForDay(currentDate);
    const dayInteractions = getInteractionsForDay(currentDate);
    const dayNotes = getNotesForDay(currentDate);
    
    const allItems = [
      ...dayEvents.map(e => ({ ...e, itemType: "event" as const })),
      ...dayTasks.map(t => ({ ...t, itemType: "task" as const })),
      ...dayInteractions.map(i => ({ ...i, itemType: "interaction" as const })),
      ...dayNotes.map(n => ({ ...n, itemType: "note" as const }))
    ];

    allItems.sort((a, b) => {
      const dateA = new Date((a as any).startTime || (a as any).dueDate || (a as any).interaction_date || (a as any).created_at);
      const dateB = new Date((b as any).startTime || (b as any).dueDate || (b as any).interaction_date || (b as any).created_at);
      return dateA.getTime() - dateB.getTime();
    });

    return (
      <div className="space-y-2">
        {allItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Sem eventos para hoje</p>
        ) : (
          allItems.map((item) => {
            if (item.itemType === "task") {
              return (
                <div
                  key={`task-${item.id}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, { 
                    id: item.id, 
                    type: "task",
                    startTime: (item as Task).dueDate || (item as Task).createdAt 
                  })}
                  onDragEnd={onDragEnd}
                >
                  <TaskCard 
                    task={item as Task} 
                    onClick={() => onTaskClick(item as Task)}
                  />
                </div>
              );
            } else if (item.itemType === "event") {
              return (
                <div
                  key={`event-${item.id}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, { 
                    id: item.id, 
                    type: "event",
                    startTime: (item as CalendarEvent).startTime 
                  })}
                  onDragEnd={onDragEnd}
                >
                  <EventCard 
                    event={item as CalendarEvent} 
                    onClick={() => onEventClick(item as CalendarEvent)}
                    onDelete={onDeleteEvent}
                  />
                </div>
              );
            } else if (item.itemType === "interaction") {
              const interaction = item as InteractionWithDetails;
              return (
                <div
                  key={`interaction-${item.id}`}
                  className="p-3 border rounded-lg bg-orange-50 border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-orange-700 uppercase">
                          {interaction.interaction_type || "Interação"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(interaction.interaction_date!).toLocaleTimeString("pt-PT", { 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {interaction.lead?.name || interaction.contact?.name || "Sem nome"}
                      </p>
                      {interaction.content && (
                        <p className="text-sm text-gray-600 line-clamp-2">{interaction.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              const note = item as CalendarNote;
              return (
                <div
                  key={`note-${item.id}`}
                  className="p-3 border rounded-lg bg-yellow-50 border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-yellow-700">📝 Nota</span>
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleTimeString("pt-PT", { 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {note.lead_name || "Lead sem nome"}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">{note.note}</p>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    );
  }

  // Week View
  if (viewMode === "week") {
    return (
      <div className="grid grid-cols-7 gap-2">
        {getWeekDays().map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const dayTasks = getTasksForDay(day);
          const dayInteractions = getInteractionsForDay(day);
          const dayNotes = getNotesForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-2 min-h-[200px] flex flex-col gap-1 ${isToday ? "bg-purple-50 border-purple-300" : ""}`}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, day)}
            >
              <div className="font-semibold text-sm mb-2 text-center sticky top-0 bg-inherit pb-1 border-b">
                {day.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric" })}
              </div>
              <div className="space-y-1 overflow-y-auto flex-1 max-h-[500px]">
                {dayEvents.map((event) => (
                  <div
                    key={`event-${event.id}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, { 
                      id: event.id, 
                      type: "event",
                      startTime: event.startTime 
                    })}
                    onDragEnd={onDragEnd}
                  >
                    <EventCard 
                      event={event}
                      onClick={() => onEventClick(event)}
                      onDelete={onDeleteEvent}
                      onDragStart={(e) => onDragStart(e, { 
                        id: event.id, 
                        type: "event",
                        startTime: event.startTime 
                      })}
                      onDragEnd={onDragEnd}
                      compact
                    />
                  </div>
                ))}
                {dayTasks.map((task) => (
                  <div 
                    key={`task-${task.id}`} 
                    draggable
                    onDragStart={(e) => onDragStart(e, { 
                      id: task.id, 
                      type: "task",
                      startTime: task.dueDate || task.createdAt 
                    })}
                    onDragEnd={onDragEnd}
                    className="text-xs rounded p-1 truncate cursor-move transition-opacity bg-blue-100 hover:bg-blue-200 border border-blue-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                  >
                    <div className="truncate font-medium">✓ {task.title}</div>
                  </div>
                ))}
                {dayInteractions.map((interaction) => (
                  <div 
                    key={`interaction-${interaction.id}`}
                    className="text-xs rounded p-1 truncate bg-orange-100 hover:bg-orange-200 border border-orange-200 cursor-pointer"
                  >
                    <div className="truncate text-orange-800">
                      <span className="mr-1">
                        {interaction.interaction_type === "email" && "📧"}
                        {interaction.interaction_type === "call" && "📞"}
                        {interaction.interaction_type === "meeting" && "🤝"}
                        {(!interaction.interaction_type || !["email", "call", "meeting"].includes(interaction.interaction_type)) && "💬"}
                      </span>
                      {interaction.lead?.name || interaction.contact?.name}
                    </div>
                  </div>
                ))}
                {dayNotes.map((note) => (
                  <div 
                    key={`note-${note.id}`}
                    className="text-xs rounded p-1 truncate bg-yellow-100 hover:bg-yellow-200 border border-yellow-200 cursor-pointer"
                  >
                    <div className="truncate text-yellow-800">
                      <span className="mr-1">📝</span> 
                      {note.lead_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Month View
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {getMonthDays().map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const dayTasks = getTasksForDay(day);
          const dayInteractions = getInteractionsForDay(day);
          const dayNotes = getNotesForDay(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = day.toDateString() === new Date().toDateString();
          const totalItems = dayEvents.length + dayTasks.length + dayInteractions.length + dayNotes.length;
          
          return (
            <div
              key={index}
              className={`border rounded-lg p-2 min-h-[100px] flex flex-col gap-1 ${
                !isCurrentMonth ? "bg-gray-50 text-gray-400" : ""
              } ${isToday ? "bg-purple-50 border-purple-300" : ""}`}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, day)}
            >
              <div className="font-semibold text-sm mb-1 text-right">
                {day.getDate()}
              </div>
              <div className="space-y-1 overflow-hidden">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={`event-${event.id}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, { 
                      id: event.id, 
                      type: "event",
                      startTime: event.startTime 
                    })}
                    onDragEnd={onDragEnd}
                  >
                    <EventCard 
                      event={event}
                      onClick={() => onEventClick(event)}
                      onDelete={onDeleteEvent}
                      onDragStart={(e) => onDragStart(e, { 
                        id: event.id, 
                        type: "event",
                        startTime: event.startTime 
                      })}
                      onDragEnd={onDragEnd}
                      compact
                    />
                  </div>
                ))}
                {dayTasks.slice(0, 1).map((task) => (
                  <div 
                    key={`task-${task.id}`} 
                    draggable
                    onDragStart={(e) => onDragStart(e, { 
                      id: task.id, 
                      type: "task",
                      startTime: task.dueDate || task.createdAt 
                    })}
                    onDragEnd={onDragEnd}
                    className="text-[10px] rounded px-1 py-0.5 truncate cursor-move transition-opacity bg-blue-100 hover:bg-blue-200 text-blue-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                  >
                    ✓ {task.title}
                  </div>
                ))}
                {dayInteractions.slice(0, 1).map((interaction) => (
                  <div 
                    key={`interaction-${interaction.id}`}
                    className="text-[10px] rounded px-1 py-0.5 truncate bg-orange-100 hover:bg-orange-200 text-orange-900"
                  >
                    <span className="mr-1">📞</span>
                    {interaction.lead?.name}
                  </div>
                ))}
                {dayNotes.slice(0, 1).map((note) => (
                  <div 
                    key={`note-${note.id}`}
                    className="text-[10px] rounded px-1 py-0.5 truncate bg-yellow-100 hover:bg-yellow-200 text-yellow-900"
                  >
                    <span className="mr-1">📝</span> Nota
                  </div>
                ))}
                {totalItems > 4 && (
                  <div className="text-[10px] text-gray-500 font-medium text-center">
                    +{totalItems - 4} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}