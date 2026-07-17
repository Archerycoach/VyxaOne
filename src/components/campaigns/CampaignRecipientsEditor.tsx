import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus, X, Search, Undo2 } from "lucide-react";
import { getLeads } from "@/services/leadsService";

export interface SimpleLead {
  id: string;
  name: string;
  email: string | null;
}

interface Props {
  /** Leads sugeridas pela IA (só as que têm email). */
  suggested: SimpleLead[];
  removedIds: Set<string>;
  onToggleRemoved: (id: string) => void;
  manualLeads: SimpleLead[];
  onAddManual: (lead: SimpleLead) => void;
  onRemoveManual: (id: string) => void;
}

export function CampaignRecipientsEditor({
  suggested,
  removedIds,
  onToggleRemoved,
  manualLeads,
  onAddManual,
  onRemoveManual,
}: Props) {
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getLeads(true).then((data) => setAllLeads(data || [])).catch(() => setAllLeads([]));
  }, []);

  const excludedIds = useMemo(() => {
    const s = new Set<string>();
    suggested.forEach((l) => s.add(l.id));
    manualLeads.forEach((l) => s.add(l.id));
    return s;
  }, [suggested, manualLeads]);

  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allLeads
      .filter((l) => l.email && !excludedIds.has(l.id))
      .filter((l) => {
        if (!q) return true;
        return [l.name, l.email, l.location_preference, l.typology]
          .filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [allLeads, search, excludedIds]);

  const finalCount = suggested.filter((l) => !removedIds.has(l.id)).length + manualLeads.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">
          Destinatários finais: <span className="text-indigo-700">{finalCount}</span>
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Adicionar leads
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center border-b px-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, email ou procura..."
                className="border-0 focus-visible:ring-0 shadow-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {allLeads.length === 0 ? "A carregar leads..." : "Nenhuma lead com email encontrada."}
                </p>
              ) : (
                searchResults.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onAddManual({ id: l.id, name: l.name, email: l.email })}
                    className="w-full text-left px-2 py-2 rounded hover:bg-slate-100"
                  >
                    <span className="block text-sm font-medium truncate">{l.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {[l.email, l.location_preference, l.typology].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Sugeridas pela IA (removíveis) */}
      {suggested.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Sugeridas pela IA</p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((l) => {
              const removed = removedIds.has(l.id);
              return (
                <Badge
                  key={l.id}
                  variant={removed ? "outline" : "secondary"}
                  className={`py-1.5 gap-1.5 ${removed ? "line-through opacity-60" : ""}`}
                >
                  {l.name}
                  <button type="button" onClick={() => onToggleRemoved(l.id)} className="ml-0.5 hover:text-red-600" title={removed ? "Repor" : "Remover"}>
                    {removed ? <Undo2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Adicionadas manualmente */}
      {manualLeads.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Adicionadas por si</p>
          <div className="flex flex-wrap gap-2">
            {manualLeads.map((l) => (
              <Badge key={l.id} className="py-1.5 gap-1.5 bg-indigo-600">
                {l.name}
                <button type="button" onClick={() => onRemoveManual(l.id)} className="ml-0.5 hover:text-red-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
