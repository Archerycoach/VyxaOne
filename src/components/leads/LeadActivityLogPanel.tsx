import { useEffect, useState } from "react";
import { getLeadActivity, type LeadActivityEntry } from "@/services/leadActivityService";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, ArrowRightLeft, PencilLine, Archive, ArchiveRestore, Merge } from "lucide-react";

interface LeadActivityLogPanelProps {
  leadId: string;
}

const ACTION_LABELS: Record<string, string> = {
  updated: "Editou",
  reassigned: "Reatribuiu",
  status_changed: "Mudou o estado",
  archived: "Arquivou",
  restored: "Restaurou",
  merged: "Fundiu com outra lead",
};

const ACTION_ICONS: Record<string, typeof PencilLine> = {
  updated: PencilLine,
  reassigned: ArrowRightLeft,
  status_changed: ArrowRightLeft,
  archived: Archive,
  restored: ArchiveRestore,
  merged: Merge,
};

export function LeadActivityLogPanel({ leadId }: LeadActivityLogPanelProps) {
  const [entries, setEntries] = useState<LeadActivityEntry[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, [leadId]);

  const loadActivity = async () => {
    setIsLoading(true);
    try {
      const data = await getLeadActivity(leadId);
      setEntries(data);

      // Resolve nomes de utilizadores referenciados em old_value/new_value
      // (ex.: reatribuições guardam UUIDs de consultores).
      const idsToResolve = new Set<string>();
      data.forEach((entry) => {
        if (entry.action === "reassigned") {
          if (entry.old_value) idsToResolve.add(entry.old_value);
          if (entry.new_value) idsToResolve.add(entry.new_value);
        }
      });
      if (idsToResolve.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(idsToResolve));
        const map: Record<string, string> = {};
        (profiles || []).forEach((p) => {
          map[p.id] = p.full_name || "Sem nome";
        });
        setNamesById(map);
      }
    } catch (error) {
      console.error("[LeadActivityLogPanel] Error loading activity:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const describeChange = (entry: LeadActivityEntry): string | null => {
    if (entry.action === "reassigned") {
      const oldName = entry.old_value ? namesById[entry.old_value] || "ninguém" : "ninguém";
      const newName = entry.new_value ? namesById[entry.new_value] || "—" : "—";
      return `${oldName} → ${newName}`;
    }
    if (entry.action === "status_changed") {
      return `${entry.old_value || "—"} → ${entry.new_value || "—"}`;
    }
    if (entry.action === "updated" && entry.field_name) {
      return `Campos: ${entry.field_name}`;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        Ainda não há atividade registada para esta lead.
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[60vh] overflow-y-auto">
      {entries.map((entry) => {
        const Icon = ACTION_ICONS[entry.action] || PencilLine;
        const description = describeChange(entry);
        return (
          <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
            <Icon className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900">
                <span className="font-medium">
                  {entry.user?.full_name || entry.user?.email || "Sistema"}
                </span>{" "}
                {ACTION_LABELS[entry.action] || entry.action}
              </div>
              {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              {new Date(entry.created_at).toLocaleString("pt-PT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
