import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskStatus, TaskPriority } from "../hooks/useTaskFilters";

interface TaskFiltersProps {
  statusFilter: TaskStatus;
  priorityFilter: TaskPriority | "all";
  searchQuery: string;
  onStatusChange: (status: TaskStatus) => void;
  onPriorityChange: (priority: TaskPriority | "all") => void;
  onSearchChange: (query: string) => void;
}

export function TaskFilters({
  statusFilter,
  priorityFilter,
  searchQuery,
  onStatusChange,
  onPriorityChange,
  onSearchChange,
}: TaskFiltersProps) {
  const statusButtons: { value: TaskStatus; label: string }[] = [
    { value: "pending", label: "Pendentes" },
    { value: "in_progress", label: "Em Progresso" },
    { value: "completed", label: "Concluídas" },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar tarefas..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusButtons.map((button) => (
          <Button
            key={button.value}
            variant={statusFilter === button.value ? "default" : "outline"}
            onClick={() => onStatusChange(button.value)}
          >
            {button.label}
          </Button>
        ))}
      </div>
    </div>
  );
}