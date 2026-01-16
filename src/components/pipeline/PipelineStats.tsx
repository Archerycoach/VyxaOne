import { Card } from "@/components/ui/card";
import type { LeadWithContacts } from "@/services/leadsService";
import type { LeadType } from "@/types";
import { TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getBuyerStages, getSellerStages, type PipelineStage } from "@/services/pipelineSettingsService";

interface PipelineStatsProps {
  leads: LeadWithContacts[];
  pipelineView: LeadType;
}

export function PipelineStats({ leads, pipelineView }: PipelineStatsProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load pipeline stages based on view
  useEffect(() => {
    const loadStages = async () => {
      setIsLoading(true);
      try {
        const loadedStages = pipelineView === "buyer" 
          ? await getBuyerStages()
          : await getSellerStages();
        setStages(loadedStages);
      } catch (error) {
        console.error("Error loading pipeline stages:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStages();
  }, [pipelineView]);

  // Calculate stats
  const total = leads.length;
  
  // Find the last stage ID (converted/won leads)
  const lastStageId = stages.length > 0 ? stages[stages.length - 1].id : null;
  
  // Count leads in the last stage (conversions)
  const conversions = lastStageId 
    ? leads.filter((l) => l.status === lastStageId).length 
    : 0;
  
  // Count qualified leads (second stage typically)
  const qualifiedStageId = stages.length > 1 ? stages[1].id : null;
  const qualified = qualifiedStageId
    ? leads.filter((l) => l.status === qualifiedStageId).length
    : 0;
  
  // Count lost leads (assuming "lost" status exists, or count by stage if custom)
  const lost = leads.filter((l) => l.status === "lost").length;
  
  // Calculate conversion rate (conversions / total)
  const conversionRate = total > 0 ? ((conversions / total) * 100).toFixed(1) : "0.0";

  const viewLabel = pipelineView === "buyer" ? "Compradores" : "Vendedores";
  const lastStageName = stages.length > 0 ? stages[stages.length - 1].name : "Fechados";

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-16 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total {viewLabel}</p>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
          <Users className="h-8 w-8 text-blue-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Qualificados</p>
            <p className="text-2xl font-bold text-gray-900">{qualified}</p>
          </div>
          <TrendingUp className="h-8 w-8 text-purple-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">{lastStageName}</p>
            <p className="text-2xl font-bold text-gray-900">{conversions}</p>
          </div>
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Taxa de Conversão</p>
            <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
          </div>
          <div className="flex flex-col items-end">
            <XCircle className="h-8 w-8 text-red-500 opacity-30" />
            <span className="text-xs text-gray-500 mt-1">{lost} perdidos</span>
          </div>
        </div>
      </Card>
    </div>
  );
}