import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, Search } from "lucide-react";
import {
  searchPropertiesSemantic,
  type SemanticPropertyResult,
} from "@/services/semanticSearchService";

/**
 * Cruza o que está escrito na lead (preferências + notas) com a carteira,
 * semanticamente — apanha o que os filtros rígidos não apanham
 * ("luminoso", "vista desafogada", "espaço para escritório").
 */

interface SemanticPropertyMatchesProps {
  leadId: string;
  onOpenProperty?: (propertyId: string) => void;
}

function similarityMeta(score: number) {
  if (score >= 70) return { label: "Forte", className: "bg-green-100 text-green-800" };
  if (score >= 45) return { label: "Razoável", className: "bg-amber-100 text-amber-800" };
  return { label: "Fraca", className: "bg-gray-100 text-gray-700" };
}

export function SemanticPropertyMatches({ leadId, onOpenProperty }: SemanticPropertyMatchesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SemanticPropertyResult[] | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState("");

  const run = async (query?: string) => {
    setLoading(true);
    setHint(null);
    try {
      const data = await searchPropertiesSemantic(
        query ? { query, limit: 10 } : { leadId, limit: 10 }
      );
      setResults(data.matches);
      setHint(data.hint || null);
      if (data.matches.length === 0 && !data.hint) {
        toast({
          title: "Sem correspondências",
          description: "Não há imóveis na carteira que correspondam a esta procura.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro na pesquisa",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => run()} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Sugerir imóveis para esta lead
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Ou descreve o que ela procura: luminoso, vista, espaço para escritório…"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customQuery.trim()) run(customQuery.trim());
          }}
        />
        <Button
          variant="outline"
          onClick={() => customQuery.trim() && run(customQuery.trim())}
          disabled={loading || !customQuery.trim()}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {hint && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {hint}
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((property) => {
            const meta = similarityMeta(property.similarity);
            return (
              <div
                key={property.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge className={meta.className} variant="outline">
                      {meta.label} · {property.similarity}%
                    </Badge>
                    {property.status && property.status !== "available" && (
                      <Badge variant="secondary">{property.status}</Badge>
                    )}
                  </div>
                  <p className="truncate font-medium">{property.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[
                      property.typology,
                      property.city,
                      property.area ? `${property.area} m²` : null,
                      property.price ? `${property.price.toLocaleString("pt-PT")} €` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {onOpenProperty && (
                  <Button size="sm" variant="outline" onClick={() => onOpenProperty(property.id)}>
                    Ver
                  </Button>
                )}
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground">
            A percentagem indica a proximidade entre o que está escrito na lead e a descrição do
            imóvel. Vale como sugestão — confirma sempre antes de apresentar ao cliente.
          </p>
        </div>
      )}
    </div>
  );
}
