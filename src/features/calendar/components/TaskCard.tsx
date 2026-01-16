import React from "react";
import { Clock } from "lucide-react";
import type { Task } from "@/types";
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  compact?: boolean;
}

export function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  compact = false,
}: TaskCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  if (compact) {
    return (
      <div 
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="text-xs rounded p-1 truncate cursor-move transition-opacity bg-blue-100 hover:bg-blue-200"
        onClick={handleClick}
      >
        <div className="font-medium">
          {task.dueDate && new Date(task.dueDate).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="truncate">{task.title}</div>
      </div>
    );
  }

  return (
    <div 
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="border rounded-lg p-4 cursor-move transition-opacity bg-blue-50 hover:bg-blue-100"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{task.title}</h3>
            {task.status && (
              <Badge
                className={
                  task.status === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : task.status === "in_progress"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }
              >
                {task.status === "completed"
                  ? "Concluída"
                  : task.status === "in_progress"
                  ? "Em Progresso"
                  : "Pendente"}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {task.dueDate && new Date(task.dueDate).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="capitalize">Tarefa</span>
            {task.priority && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                task.priority === "high" 
                  ? "bg-red-100 text-red-800" 
                  : task.priority === "medium"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
              }`}>
                {task.priority === "high" ? "Alta" : 
                 task.priority === "medium" ? "Média" : "Baixa"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}