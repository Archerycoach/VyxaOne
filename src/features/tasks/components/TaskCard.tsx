import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Building2,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAddNote: (task: Task) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "in_progress":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "pending":
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    in_progress: "secondary",
    pending: "outline",
  };

  const labels: Record<string, string> = {
    completed: "Concluída",
    in_progress: "Em Progresso",
    pending: "Pendente",
  };

  return (
    <Badge variant={variants[status] || "outline"}>
      {labels[status] || status}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };

  const labels: Record<string, string> = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };

  return (
    <Badge className={colors[priority] || ""} variant="outline">
      {labels[priority] || priority}
    </Badge>
  );
};

export function TaskCard({ task, onComplete, onEdit, onDelete, onAddNote }: TaskCardProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";

  return (
    <Card className={`hover:shadow-lg transition-shadow ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-2 flex-1">
          {getStatusIcon(task.status)}
          <div className="flex-1">
            <CardTitle className="text-base font-semibold line-clamp-2">
              {task.title}
            </CardTitle>
          </div>
        </div>
        <div className="flex gap-1">
          {getStatusBadge(task.status)}
          {getPriorityBadge(task.priority)}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {task.description}
        </p>

        {task.notes && (
          <div className="mb-4 p-2 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {task.dueDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                {new Date(task.dueDate).toLocaleDateString("pt-PT")}
                {isOverdue && " (Atrasada)"}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {task.status !== "completed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                console.log("🟢 Complete button clicked for task:", task.id);
                onComplete(task.id);
              }}
              className="flex-1"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Concluir
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNote(task)}
          >
            <StickyNote className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(task)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              console.log("🔴 Delete button clicked for task:", task.id);
              onDelete(task.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}