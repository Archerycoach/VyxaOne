import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface LeadFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterChange: (value: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
}

export function LeadFilters({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  showArchived,
  onToggleArchived,
}: LeadFiltersProps) {
  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant={filterType === "all" ? "default" : "outline"}
          onClick={() => onFilterChange("all")}
          className={filterType === "all" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          Todos
        </Button>
        <Button
          variant={filterType === "buyer" ? "default" : "outline"}
          onClick={() => onFilterChange("buyer")}
          className={filterType === "buyer" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          Compradores
        </Button>
        <Button
          variant={filterType === "seller" ? "default" : "outline"}
          onClick={() => onFilterChange("seller")}
          className={filterType === "seller" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          Vendedores
        </Button>
        <div className="ml-auto">
          <Button
            variant={showArchived ? "default" : "outline"}
            onClick={onToggleArchived}
            className={showArchived ? "bg-gray-600 hover:bg-gray-700" : ""}
          >
            {showArchived ? "Ver Ativas" : "Ver Arquivadas"}
          </Button>
        </div>
      </div>
    </div>
  );
}