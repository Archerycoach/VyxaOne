import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxUser {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email: string;
}

interface UserComboboxProps {
  users: ComboboxUser[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

// Select com pesquisa por nome/email (Popover + Command), em vez de um
// pull-down simples — usado sempre que é preciso escolher um utilizador
// numa lista que pode crescer (atribuir/partilhar leads, convidar consultor).
export function UserCombobox({
  users,
  value,
  onChange,
  placeholder = "Selecione um utilizador",
  emptyText = "Nenhum utilizador encontrado.",
  disabled,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const label = (u: ComboboxUser) => u.full_name || u.name || u.email;
  const selected = users.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? label(selected) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Pesquisar por nome..." />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {users.map((u) => (
              <CommandItem
                key={u.id}
                value={`${label(u)} ${u.email}`}
                onSelect={() => {
                  onChange(u.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === u.id ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col">
                  <span className="font-medium">{label(u)}</span>
                  <span className="text-xs text-gray-500">{u.email}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
