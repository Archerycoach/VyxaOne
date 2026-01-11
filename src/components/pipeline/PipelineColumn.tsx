import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";
import type { LeadWithContacts } from "@/services/leadsService";

interface PipelineColumnProps {
  id: string;
  title: string;
  color: string;
  leads: LeadWithContacts[];
  isDragging?: boolean;
  onLeadClick?: (lead: LeadWithContacts) => void;
  onLeadDelete?: (leadId: string) => void;
}

export function PipelineColumn({ id, title, color, leads, isDragging, onLeadClick, onLeadDelete }: PipelineColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 p-3 bg-white rounded-lg shadow-sm border flex-shrink-0">
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: color }}
        />
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto text-sm text-gray-500">{leads.length}</span>
      </div>
      <div 
        ref={setNodeRef}
        className="flex-1 p-3 space-y-3 overflow-y-auto rounded-lg bg-gray-50/50 min-h-0"
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick?.(lead)}
            onDelete={onLeadDelete}
          />
        ))}
        {leads.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            Arraste leads para aqui
          </p>
        )}
      </div>
    </div>
  );
}