import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getLeadQualification,
  formatCurrentQualificationValue,
  type QualifiableLeadData,
} from "@/lib/leadQualification";

interface Props {
  lead: QualifiableLeadData;
}

/**
 * Mostra TODOS os campos de qualificação relevantes para o tipo de lead
 * (comprador e/ou vendedor), incluindo os que estão em falta — para que o
 * utilizador veja de imediato o que ainda falta preencher, sem precisar de
 * abrir a edição da lead.
 *
 * É orientado pelo catálogo QUALIFICATION_FIELDS, por isso mantém-se sempre
 * sincronizado com os campos reais dos formulários.
 */
export function LeadQualificationOverview({ lead }: Props) {
  const { relevantFields, filled, total, percentage } = getLeadQualification(lead);

  if (total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Dados de Qualificação
          </span>
          <Badge
            variant="outline"
            className={
              percentage === 100
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }
          >
            {filled}/{total} · {percentage}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {relevantFields.map((field) => {
          const isFilled = field.isFilled(lead);
          const value = formatCurrentQualificationValue(lead, field.key);

          return (
            <div
              key={field.key}
              className={`flex items-start gap-2 rounded-md border p-2.5 ${
                isFilled
                  ? "border-gray-100 bg-white"
                  : "border-amber-200 bg-amber-50/60"
              }`}
            >
              {isFilled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{field.label}</p>
                {isFilled ? (
                  <p className="font-medium break-words">{value}</p>
                ) : (
                  <p className="font-medium text-amber-700">Em falta</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default LeadQualificationOverview;
