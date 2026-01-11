import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

interface SortableStageItemProps {
  stage: PipelineStage;
  index: number;
  onUpdate: (index: number, field: keyof PipelineStage, value: string) => void;
  onRemove: (index: number) => void;
}

function SortableStageItem({ stage, index, onUpdate, onRemove }: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50/50"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-slate-400" />
      </div>
      
      <div className="flex-1">
        <Label className="text-xs text-slate-600 mb-1">Nome do Estágio</Label>
        <Input 
          value={stage.name} 
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          className="bg-white"
        />
      </div>
      
      <div className="w-32">
        <Label className="text-xs text-slate-600 mb-1">ID</Label>
        <Input 
          value={stage.id} 
          onChange={(e) => onUpdate(index, "id", e.target.value)}
          className="font-mono text-xs bg-white"
        />
      </div>
      
      <div className="w-32">
        <Label className="text-xs text-slate-600 mb-1">Cor (Hex)</Label>
        <div className="flex gap-2">
          <Input 
            type="color"
            value={stage.color} 
            onChange={(e) => onUpdate(index, "color", e.target.value)}
            className="w-12 h-10 p-1 cursor-pointer"
          />
          <Input 
            value={stage.color} 
            onChange={(e) => onUpdate(index, "color", e.target.value)}
            className="flex-1 font-mono text-xs bg-white"
            placeholder="#3B82F6"
          />
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon"
        onClick={() => onRemove(index)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PipelineSettings() {
  const { toast } = useToast();
  const [buyerStages, setBuyerStages] = useState<PipelineStage[]>([]);
  const [sellerStages, setSellerStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent, type: "buyer" | "seller") => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const stages = type === "buyer" ? buyerStages : sellerStages;
    const setStages = type === "buyer" ? setBuyerStages : setSellerStages;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    setStages(arrayMove(stages, oldIndex, newIndex));
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // Fetch buyer stages
      const { data: buyerData, error: buyerError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "pipeline_stages_buyers")
        .maybeSingle();

      if (buyerError && buyerError.code !== "PGRST116") throw buyerError;

      if (buyerData) {
        setBuyerStages(buyerData.value as unknown as PipelineStage[]);
      } else {
        // Default buyer stages
        setBuyerStages([
          { id: "new", name: "Nova Lead", color: "#3B82F6" },
          { id: "qualified", name: "Qualificada", color: "#10B981" },
          { id: "visit", name: "Visita Agendada", color: "#8B5CF6" },
          { id: "proposal", name: "Proposta", color: "#F59E0B" },
          { id: "negotiation", name: "Negociação", color: "#EF4444" },
          { id: "closed", name: "Fechado", color: "#059669" },
        ]);
      }

      // Fetch seller stages
      const { data: sellerData, error: sellerError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "pipeline_stages_sellers")
        .maybeSingle();

      if (sellerError && sellerError.code !== "PGRST116") throw sellerError;

      if (sellerData) {
        setSellerStages(sellerData.value as unknown as PipelineStage[]);
      } else {
        // Default seller stages
        setSellerStages([
          { id: "new-contact", name: "Novo Contacto", color: "#3B82F6" },
          { id: "evaluation", name: "Avaliação", color: "#10B981" },
          { id: "documentation", name: "Documentação", color: "#8B5CF6" },
          { id: "marketing", name: "Marketing", color: "#F59E0B" },
          { id: "negotiation", name: "Negociação", color: "#EF4444" },
          { id: "sold", name: "Vendido", color: "#059669" },
        ]);
      }
    } catch (error) {
      console.error("Error fetching pipeline settings:", error);
      toast({
        title: "Erro ao carregar configurações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save buyer stages
      const { error: buyerError } = await supabase
        .from("system_settings")
        .upsert({
          key: "pipeline_stages_buyers",
          value: buyerStages as any,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

      if (buyerError) throw buyerError;

      // Save seller stages
      const { error: sellerError } = await supabase
        .from("system_settings")
        .upsert({
          key: "pipeline_stages_sellers",
          value: sellerStages as any,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

      if (sellerError) throw sellerError;

      toast({
        title: "✅ Configurações guardadas",
        description: "Os pipelines de compradores e vendedores foram atualizados.",
      });
    } catch (error) {
      console.error("Error saving pipeline settings:", error);
      toast({
        title: "Erro ao guardar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addStage = (type: "buyer" | "seller") => {
    const newStage = { 
      id: `stage-${Date.now()}`, 
      name: "Novo Estágio", 
      color: "#6B7280" 
    };
    
    if (type === "buyer") {
      setBuyerStages([...buyerStages, newStage]);
    } else {
      setSellerStages([...sellerStages, newStage]);
    }
  };

  const removeStage = (type: "buyer" | "seller", index: number) => {
    if (type === "buyer") {
      const newStages = [...buyerStages];
      newStages.splice(index, 1);
      setBuyerStages(newStages);
    } else {
      const newStages = [...sellerStages];
      newStages.splice(index, 1);
      setSellerStages(newStages);
    }
  };

  const updateStage = (type: "buyer" | "seller", index: number, field: keyof PipelineStage, value: string) => {
    if (type === "buyer") {
      const newStages = [...buyerStages];
      newStages[index] = { ...newStages[index], [field]: value };
      setBuyerStages(newStages);
    } else {
      const newStages = [...sellerStages];
      newStages[index] = { ...newStages[index], [field]: value };
      setSellerStages(newStages);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎯 Configuração do Pipeline
        </CardTitle>
        <CardDescription>
          Personalizar etapas do funil de vendas para compradores e vendedores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Pipeline Compradores */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">📍 Pipeline Compradores</h3>
            <Button variant="outline" size="sm" onClick={() => addStage("buyer")}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Estágio
            </Button>
          </div>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(e, "buyer")}
          >
            <SortableContext
              items={buyerStages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {buyerStages.map((stage, index) => (
                  <SortableStageItem
                    key={stage.id}
                    stage={stage}
                    index={index}
                    onUpdate={(idx, field, value) => updateStage("buyer", idx, field, value)}
                    onRemove={(idx) => removeStage("buyer", idx)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Pipeline Vendedores */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">📍 Pipeline Vendedores</h3>
            <Button variant="outline" size="sm" onClick={() => addStage("seller")}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Estágio
            </Button>
          </div>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(e, "seller")}
          >
            <SortableContext
              items={sellerStages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {sellerStages.map((stage, index) => (
                  <SortableStageItem
                    key={stage.id}
                    stage={stage}
                    index={index}
                    onUpdate={(idx, field, value) => updateStage("seller", idx, field, value)}
                    onRemove={(idx) => removeStage("seller", idx)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Nota informativa */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            ℹ️ <strong>Nota:</strong> A personalização avançada de etapas do pipeline estará disponível em breve. 
            Por agora, as etapas padrão estão otimizadas para o mercado imobiliário.
          </p>
        </div>

        {/* Botão Guardar */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Guardar Pipeline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}