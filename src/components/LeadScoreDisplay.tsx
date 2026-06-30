import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Star, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { calculateLeadScore, getLeadScoreHistory, getScoreTrend } from "@/services/leadScoringService";

interface LeadScoreDisplayProps {
  leadId: string;
}

export function LeadScoreDisplay({ leadId }: LeadScoreDisplayProps) {
  const [score, setScore] = useState(0);
  const [trend, setTrend] = useState<"up" | "down" | "stable">("stable");
  const [scoreComponents, setScoreComponents] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScore();
  }, [leadId]);

  const loadScore = async () => {
    try {
      setLoading(true);
      
      // Recalcular score atual
      const calculatedScore = await calculateLeadScore(leadId);
      setScore(calculatedScore);

      // Buscar histórico
      const scoreHistory = await getLeadScoreHistory(leadId);
      setHistory(scoreHistory);

      // Calcular tendência
      const scoreTrend = getScoreTrend(scoreHistory);
      setTrend(scoreTrend);

      // Componentes do score (do último histórico)
      if (scoreHistory.length > 0) {
        setScoreComponents({
          responseTime: scoreHistory[0].response_time_score || 0,
          engagement: scoreHistory[0].engagement_score || 0,
          budgetFit: scoreHistory[0].budget_fit_score || 0,
          source: scoreHistory[0].source_score || 0,
          recency: scoreHistory[0].recency_score || 0,
        });
      }
    } catch (error) {
      console.error('Error loading lead score:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return { label: '🔥 Muito Quente', color: 'bg-red-100 text-red-800 border-red-200' };
    if (score >= 60) return { label: '🌡️ Quente', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (score >= 40) return { label: '☀️ Morno', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    if (score >= 20) return { label: '❄️ Frio', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: '🧊 Muito Frio', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendLabel = () => {
    if (trend === "up") return "A subir";
    if (trend === "down") return "A descer";
    return "Estável";
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-green-600 bg-green-50 border-green-200";
    if (trend === "down") return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const scoreInfo = getScoreLabel(score);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Score Comportamental
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
          <Activity className="h-5 w-5" />
          Score Comportamental
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Score number + badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-blue-600">{score}</div>
              <div className="text-sm text-gray-500">/100</div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge className={scoreInfo.color} variant="outline">{scoreInfo.label}</Badge>
              <Badge className={getTrendColor()} variant="outline">
                <span className="flex items-center gap-1">
                  {getTrendIcon()}
                  {getTrendLabel()}
                </span>
              </Badge>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={score} className="h-3" />

          {/* Score breakdown */}
          {scoreComponents && (
            <div className="space-y-2 text-sm border-t pt-4">
              <p className="font-medium text-gray-700 mb-2">Componentes do Score:</p>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">⏱️ Tempo de Resposta:</span>
                <span className="font-medium text-blue-600">{scoreComponents.responseTime}/20</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">💬 Engajamento:</span>
                <span className="font-medium text-blue-600">{scoreComponents.engagement}/25</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">💰 Fit Orçamento:</span>
                <span className="font-medium text-blue-600">{scoreComponents.budgetFit}/20</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">📍 Canal de Origem:</span>
                <span className="font-medium text-blue-600">{scoreComponents.source}/15</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">📅 Recência de Contacto:</span>
                <span className="font-medium text-blue-600">{scoreComponents.recency}/20</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="rounded-lg bg-blue-50 p-3 text-sm border border-blue-200">
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
            {score >= 20 && score < 40 && (
              <p className="text-blue-700">
                Lead frio. Considere nutrição com conteúdo de valor e follow-ups espaçados.
              </p>
            )}
            {score < 20 && (
              <p className="text-blue-700">
                Lead muito frio. Avalie se vale a pena continuar investindo tempo.
              </p>
            )}
          </div>

          {/* Score history mini chart */}
          {history.length > 1 && (
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Evolução (últimos 7 registos):</p>
              <div className="flex items-end gap-1 h-12">
                {history.slice(0, 7).reverse().map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-200 rounded-t hover:bg-blue-300 transition-colors"
                    style={{ height: `${h.score}%` }}
                    title={`Score: ${h.score} (${new Date(h.calculated_at).toLocaleDateString('pt-PT')})`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}