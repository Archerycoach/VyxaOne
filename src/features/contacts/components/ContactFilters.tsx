import React from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ContactFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function ContactFilters({ searchTerm, onSearchChange }: ContactFiltersProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Pesquisar contactos..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}