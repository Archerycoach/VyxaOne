import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "./EventCard";
import { TaskCard } from "./TaskCard";
import { DayEventsDialog } from "./DayEventsDialog";
import type { CalendarEvent, Task } from "@/types";

interface CalendarGridProps {
  viewMode: "day" | "week" | "month";
  currentDate: Date;
  events: CalendarEvent[];
  tasks: Task[];
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
  onEventClick,
  onTaskClick,
  onDeleteEvent,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: CalendarGridProps) {
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [selectedDayTasks, setSelectedDayTasks] = useState<Task[]>([]);

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
  console.log("[CalendarGrid] ===== DEBUG END =====");

  const handleShowAllForDay = (day: Date, dayEvents: CalendarEvent[], dayTasks: Task[]) => {
    setSelectedDayDate(day);
    setSelectedDayEvents(dayEvents);
    setSelectedDayTasks(dayTasks);
    setDayDialogOpen(true);
  };

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
    
    const allItems = [
      ...dayEvents.map(e => ({ ...e, itemType: "event" as const })),
      ...dayTasks.map(t => ({ ...t, itemType: "task" as const }))
    ];

    allItems.sort((a, b) => {
      const dateA = new Date((a as any).startTime || (a as any).dueDate);
      const dateB = new Date((b as any).startTime || (b as any).dueDate);
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
            } else {
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
                    onDelete={(eventId) => {
                      if (onDeleteEvent) {
                        onDeleteEvent(eventId);
                      }
                    }}
                    showSyncStatus={true}
                  />
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
      <>
        <div className="grid grid-cols-7 gap-2">
          {getWeekDays().map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const dayTasks = getTasksForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            const totalItems = dayEvents.length + dayTasks.length;
            
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
                  {dayEvents.slice(0, 3).map((event) => (
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
                        onDelete={(eventId) => {
                          if (onDeleteEvent) {
                            onDeleteEvent(eventId);
                          }
                        }}
                        onDragStart={(e) => onDragStart(e, { 
                          id: event.id, 
                          type: "event",
                          startTime: event.startTime 
                        })}
                        onDragEnd={onDragEnd}
                        compact
                        showSyncStatus={true}
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
                      className="text-xs rounded p-1 truncate cursor-move transition-opacity bg-blue-100 hover:bg-blue-200 border border-blue-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
                      }}
                    >
                      <div className="truncate font-medium">✓ {task.title}</div>
                    </div>
                  ))}
                  {totalItems > 4 && (
                    <button
                      onClick={() => handleShowAllForDay(day, dayEvents, dayTasks)}
                      className="text-[10px] text-purple-600 hover:text-purple-800 font-medium text-center w-full py-1 hover:bg-purple-50 rounded transition-colors"
                    >
                      +{totalItems - 4} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <DayEventsDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          date={selectedDayDate || new Date()}
          events={selectedDayEvents}
          tasks={selectedDayTasks}
          onEventClick={onEventClick}
          onTaskClick={onTaskClick}
          onDeleteEvent={onDeleteEvent}
        />
      </>
    );
  }

  // Month View
  return (
    <>
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
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            const totalItems = dayEvents.length + dayTasks.length;
            
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
                        onDelete={(eventId) => {
                          if (onDeleteEvent) {
                            onDeleteEvent(eventId);
                          }
                        }}
                        onDragStart={(e) => onDragStart(e, { 
                          id: event.id, 
                          type: "event",
                          startTime: event.startTime 
                        })}
                        onDragEnd={onDragEnd}
                        compact
                        showSyncStatus={true}
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
                  {totalItems > 3 && (
                    <button
                      onClick={() => handleShowAllForDay(day, dayEvents, dayTasks)}
                      className="text-[10px] text-purple-600 hover:text-purple-800 font-medium text-center w-full hover:bg-purple-50 rounded transition-colors cursor-pointer"
                    >
                      +{totalItems - 3} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <DayEventsDialog
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        date={selectedDayDate || new Date()}
        events={selectedDayEvents}
        tasks={selectedDayTasks}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onDeleteEvent={onDeleteEvent}
      />
    </>
  );
}