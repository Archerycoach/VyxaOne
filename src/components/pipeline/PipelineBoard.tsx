import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { PipelineColumn } from "./PipelineColumn";
import { LeadCard } from "./LeadCard";
import type { LeadWithContacts } from "@/services/leadsService";
import type { LeadType } from "@/types";
import { getBuyerStages, getSellerStages, type PipelineStage } from "@/services/pipelineSettingsService";

interface PipelineBoardProps {
  leads: LeadWithContacts[];
  onLeadMove: (leadId: string, newStatus: string) => void;
  onLeadClick: (lead: LeadWithContacts) => void;
  onLeadDelete?: (leadId: string) => void;
  isLoading?: boolean;
  pipelineView: LeadType;
}

export function PipelineBoard({ leads, onLeadMove, onLeadClick, onLeadDelete, isLoading, pipelineView }: PipelineBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [buyerStages, setBuyerStages] = useState<PipelineStage[]>([]);
  const [sellerStages, setSellerStages] = useState<PipelineStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);

  useEffect(() => {
    const loadStages = async () => {
      setStagesLoading(true);
      try {
        const [buyers, sellers] = await Promise.all([
          getBuyerStages(),
          getSellerStages(),
        ]);
        setBuyerStages(buyers);
        setSellerStages(sellers);
      } catch (error) {
        console.error("Error loading pipeline stages:", error);
      } finally {
        setStagesLoading(false);
      }
    };

    loadStages();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as string;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    onLeadMove(leadId, newStatus);
  };

  const getLeadsByStage = (stage: string) => {
    return leads.filter((lead) => lead.status === stage);
  };

  const activeLead = activeId ? leads.find((lead) => lead.id === activeId) : null;

  const stages = pipelineView === "buyer" ? buyerStages : sellerStages;

  if (isLoading || stagesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 pb-4 overflow-x-auto h-[calc(100vh-240px)]">
        {stages.map((stage) => (
          <div key={stage.id} className="min-w-[320px] max-w-[320px] flex-shrink-0">
            <PipelineColumn
              id={stage.id}
              title={stage.name}
              color={stage.color}
              leads={getLeadsByStage(stage.id)}
              isDragging={isDragging}
              onLeadClick={onLeadClick}
              onLeadDelete={onLeadDelete}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="opacity-80 rotate-3 cursor-grabbing">
            <LeadCard lead={activeLead} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}