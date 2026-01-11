import { useEffect, useState } from "react";
import { TrendingUp, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { calculateLeadScore } from "@/services/leadScoringService";

interface LeadScoreDisplayProps {
  leadId: string;
}

export function LeadScoreDisplay({ leadId }: LeadScoreDisplayProps) {
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScore();
  }, [leadId]);

  const loadScore = async () => {
    try {
      setLoading(true);
      const calculatedScore = await calculateLeadScore(leadId);
      setScore(calculatedScore);
    } catch (error) {
      console.error('Error loading lead score:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return { label: '🔥 Muito Quente', color: 'text-red-600 bg-red-50' };
    if (score >= 60) return { label: '🌡️ Quente', color: 'text-orange-600 bg-orange-50' };
    if (score >= 40) return { label: '☀️ Morno', color: 'text-yellow-600 bg-yellow-50' };
    if (score >= 20) return { label: '❄️ Frio', color: 'text-blue-600 bg-blue-50' };
    return { label: '🧊 Muito Frio', color: 'text-gray-600 bg-gray-50' };
  };

  const scoreInfo = getScoreLabel(score);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Lead Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Lead Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Score number */}
          <div className="flex items-center justify-between">
            <div className="text-4xl font-bold text-blue-600">{score}</div>
            <Badge className={scoreInfo.color}>{scoreInfo.label}</Badge>
          </div>

          {/* Progress bar */}
          <Progress value={score} className="h-3" />

          {/* Score breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Completude de Dados:</span>
              <span className="font-medium">30%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Qualidade do Orçamento:</span>
              <span className="font-medium">20%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Engajamento:</span>
              <span className="font-medium">50%</span>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-lg bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-900 mb-1">💡 Recomendação:</p>
            {score >= 80 && (
              <p className="text-blue-700">
                Lead muito quente! Priorize o contacto imediato e agende visita.
              </p>
            )}
            {score >= 60 && score < 80 && (
              <p className="text-blue-700">
                Lead promissor. Mantenha contacto regular e envie sugestões personalizadas.
              </p>
            )}
            {score >= 40 && score < 60 && (
              <p className="text-blue-700">
                Lead com potencial. Tente obter mais informações sobre necessidades específicas.
              </p>
            )}
            {score < 40 && (
              <p className="text-blue-700">
                Lead frio. Considere nutrição com conteúdo de valor e follow-ups espaçados.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}