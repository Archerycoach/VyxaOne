import React from "react";
import { Check, Clock, User } from "lucide-react";
import type { Task } from "@/types";
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  compact?: boolean;
  /** Concluir a tarefa diretamente do cartão da Agenda. */
  onComplete?: (taskId: string) => void;
}

export function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  compact = false,
  onComplete,
}: TaskCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const isCompleted = task.status === "completed";
  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onComplete && !isCompleted) onComplete(task.id);
  };

  if (compact) {
    return (
      <div 
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`text-xs rounded p-1 truncate cursor-move transition-opacity bg-blue-100 hover:bg-blue-200 group relative ${isCompleted ? "opacity-55" : ""}`}
        onClick={handleClick}
      >
        {onComplete && !isCompleted && (
          <button
            type="button"
            className="absolute top-0 right-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-green-200"
            onClick={handleComplete}
            title="Marcar como concluída"
          >
            <Check className="h-3 w-3 text-green-700" />
          </button>
        )}
        <div className="font-medium">
          {task.dueDate && new Date(task.dueDate).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className={`truncate ${isCompleted ? "line-through" : ""}`}>{task.title}</div>
        {task.relatedLeadName && (
          <div className="truncate text-[10px] text-blue-800/80">{task.relatedLeadName}</div>
        )}
      </div>
    );
  }

  return (
    <div 
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border rounded-lg p-4 cursor-move transition-opacity bg-blue-50 hover:bg-blue-100 group relative ${isCompleted ? "opacity-60" : ""}`}
      onClick={handleClick}
    >
      {onComplete && !isCompleted && (
        <button
          type="button"
          className="absolute top-2 right-2 rounded-md p-1.5 opacity-0 group-hover:opacity-100 hover:bg-green-100 transition-opacity"
          onClick={handleComplete}
          title="Marcar como concluída"
        >
          <Check className="h-4 w-4 text-green-700" />
        </button>
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold ${isCompleted ? "line-through text-gray-500" : ""}`}>{task.title}</h3>
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
          {task.relatedLeadName && (
            <div className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.relatedLeadName}</span>
            </div>
          )}
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