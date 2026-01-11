import { useEffect, useState } from "react";
import { Target, MapPin, Home, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findMatchesForLead } from "@/services/matchingService";

interface PropertyMatchesProps {
  leadId: string;
}

export function PropertyMatches({ leadId }: PropertyMatchesProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, [leadId]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const results = await findMatchesForLead(leadId);
      setMatches(results);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Imóveis Sugeridos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Imóveis Sugeridos ({matches.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {matches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Home className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum imóvel correspondente encontrado</p>
              </div>
            ) : (
              matches.map((match) => (
                <div
                  key={match.property.id}
                  className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{match.property.title}</h4>
                        <Badge className={`${getMatchColor(match.match_score)} text-white`}>
                          {match.match_score}% Match
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{match.property.city}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4" />
                          <span>{match.property.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Euro className="h-4 w-4" />
                          <span className="font-semibold text-blue-600">
                            {formatPrice(match.property.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      Ver Detalhes
                    </Button>
                    <Button size="sm" className="flex-1">
                      Enviar ao Cliente
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}