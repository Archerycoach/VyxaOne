import { Card } from "@/components/ui/card";
import type { LeadWithContacts } from "@/services/leadsService";
import type { LeadType } from "@/types";
import { TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";

interface PipelineStatsProps {
  leads: LeadWithContacts[];
  pipelineView: LeadType;
}

export function PipelineStats({ leads, pipelineView }: PipelineStatsProps) {
  const total = leads.length;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : "0.0";

  const viewLabel = pipelineView === "buyer" ? "Compradores" : "Vendedores";

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
            <p className="text-sm text-gray-600">{pipelineView === "buyer" ? "Fechados" : "Vendidos"}</p>
            <p className="text-2xl font-bold text-gray-900">{won}</p>
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