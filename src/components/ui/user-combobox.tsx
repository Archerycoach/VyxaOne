import { useEffect, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
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
//
// Usa os primitivos do Radix Popover diretamente (em vez do wrapper
// partilhado) para poder apontar o Portal para o Dialog ancestral, quando
// existe um: o Portal por defeito renderiza em document.body, fora da
// árvore DOM do Dialog, e o "focus trap" do Dialog devolve sempre o foco
// para dentro de si mesmo sempre que deteta foco fora da sua própria
// subárvore — o que impedia por completo escrever no campo de pesquisa.
export function UserCombobox({
  users,
  value,
  onChange,
  placeholder = "Selecione um utilizador",
  emptyText = "Nenhum utilizador encontrado.",
  disabled,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = (u: ComboboxUser) => u.full_name || u.name || u.email;
  const selected = users.find((u) => u.id === value);

  useEffect(() => {
    if (!open) return;
    const dialogEl = triggerRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    setPortalContainer(dialogEl || undefined);
  }, [open]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          ref={triggerRef}
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
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
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
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
