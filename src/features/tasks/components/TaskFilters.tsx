import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { TaskFilterStatus } from "../hooks/useTaskFilters";

interface TaskFiltersProps {
  filter: TaskFilterStatus;
  onFilterChange: (filter: TaskFilterStatus) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function TaskFilters({
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
}: TaskFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar tarefas..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      <Tabs value={filter} onValueChange={(value) => onFilterChange(value as TaskFilterStatus)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="in_progress">Em Progresso</TabsTrigger>
          <TabsTrigger value="completed">Concluídas</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}