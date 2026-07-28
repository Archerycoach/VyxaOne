import { useEffect, useMemo, useRef, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, User } from "lucide-react";
import type { LeadScopeContext } from "@/services/leadsService";

/**
 * Filtro de âmbito das leads para TEAM LEADS e CONSULTORES que veem a equipa.
 *
 * - Team lead: "Ambas (eu + equipa)" / "As minhas" / "Da equipa" + escolher um
 *   consultor específico da equipa.
 * - Consultor (que vê as leads do team lead): "Ambas" / "As minhas" /
 *   "Do team lead (Nome)".
 *
 * A escolha é MEMORIZADA por utilizador em localStorage, por isso persiste entre
 * sessões. Devolve, além do valor, a lista de donos (assigned_to) a mostrar —
 * `null` = todas as visíveis — para o container filtrar a consulta e as
 * contagens de forma consistente. Broker/admin usam o ScopeSelector completo, e
 * este componente esconde-se para eles (e para consultores sem equipa visível).
 */

interface Option {
  value: string;
  label: string;
}

interface Props {
  ctx: LeadScopeContext | null;
  /** Disparado no arranque (valor memorizado/predefinido) e a cada mudança. */
  onChange: (value: string, assignedIds: string[] | null) => void;
}

const storageKeyFor = (userId: string) => `vyxa_leads_scope_${userId}`;

function resolveIds(ctx: LeadScopeContext, value: string): string[] | null {
  if (ctx.role === "team_lead") {
    if (value === "all") return null; // tudo o que é visível (ele + equipa)
    if (value === "mine") return [ctx.currentUserId];
    if (value === "team") {
      return ctx.teamMembers.length > 0 ? ctx.teamMembers.map((m) => m.id) : [ctx.currentUserId];
    }
    return [value]; // consultor específico
  }
  // consultor
  if (value === "both") return ctx.teamLeadId ? [ctx.currentUserId, ctx.teamLeadId] : [ctx.currentUserId];
  if (value === "mine") return [ctx.currentUserId];
  if (value === "teamlead") return ctx.teamLeadId ? [ctx.teamLeadId] : [ctx.currentUserId];
  return null;
}

export function LeadScopeFilter({ ctx, onChange }: Props) {
  const [value, setValue] = useState<string>("");
  const initialisedRef = useRef(false);

  const applicable = !!ctx && (ctx.role === "team_lead" || (ctx.role === "consultant" && ctx.seesTeamLeadLeads));

  const options: Option[] = useMemo(() => {
    if (!ctx) return [];
    if (ctx.role === "team_lead") {
      const base: Option[] = [
        { value: "all", label: "Ambas (eu + equipa)" },
        { value: "mine", label: "As minhas" },
        { value: "team", label: "Da equipa" },
      ];
      return [...base, ...ctx.teamMembers.map((m) => ({ value: m.id, label: m.name }))];
    }
    if (ctx.role === "consultant" && ctx.seesTeamLeadLeads) {
      return [
        { value: "both", label: "Ambas" },
        { value: "mine", label: "As minhas" },
        { value: "teamlead", label: `Do team lead${ctx.teamLeadName ? ` (${ctx.teamLeadName})` : ""}` },
      ];
    }
    return [];
  }, [ctx]);

  // Inicializa UMA vez com o valor memorizado (ou predefinido) assim que o
  // contexto e as opções existem — e comunica-o ao container.
  useEffect(() => {
    if (!ctx || !applicable || initialisedRef.current || options.length === 0) return;
    initialisedRef.current = true;

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKeyFor(ctx.currentUserId));
    } catch {
      // localStorage indisponível — segue com o valor predefinido.
    }
    const validSaved = saved && options.some((o) => o.value === saved) ? saved : null;
    const initial = validSaved || (ctx.role === "team_lead" ? "all" : "both");

    setValue(initial);
    onChange(initial, resolveIds(ctx, initial));
  }, [ctx, applicable, options, onChange]);

  const handleChange = (next: string) => {
    if (!ctx) return;
    setValue(next);
    try {
      localStorage.setItem(storageKeyFor(ctx.currentUserId), next);
    } catch {
      // ignora — a persistência é best-effort.
    }
    onChange(next, resolveIds(ctx, next));
  };

  if (!ctx || !applicable || options.length === 0) return null;

  const Icon = ctx.role === "team_lead" ? Users : User;
  const quickCount = ctx.role === "team_lead" ? 3 : options.length;

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-[210px] h-9 bg-white">
        <Icon className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Âmbito" />
      </SelectTrigger>
      <SelectContent>
        {options.slice(0, quickCount).map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
        {ctx.role === "team_lead" && ctx.teamMembers.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Consultor específico</div>
            {options.slice(3).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
