import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, ClipboardCheck, PhoneCall, Flame, ArrowRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OrganizerSummary {
  summary: string;
  overdueTasks: { id: string }[];
  followUpDueLeads: { id: string }[];
  hotLeadsStale: { id: string }[];
}

/**
 * Resumo automático do Agente IA, mostrado logo à entrada no Dashboard —
 * reaproveita o mesmo endpoint de "O Meu Dia" (/api/gpt/agents/organizer),
 * sem duplicar a lógica determinística nem gerar um novo custo de IA extra.
 */
export function AiAssistantCard() {
  const router = useRouter();
  const [data, setData] = useState<OrganizerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.access_token) return;

        const response = await fetch("/api/gpt/agents/organizer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (!response.ok) throw new Error("Falha ao carregar o resumo do assistente");

        const result = await response.json();
        if (active) setData(result);
      } catch (error) {
        console.error("[AiAssistantCard] Falha ao carregar resumo (não bloqueante):", error);
        if (active) setFailed(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Falha silenciosa: um card de IA indisponível nunca deve impedir o resto
  // do Dashboard de aparecer.
  if (failed) return null;

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
        <div className="h-4 w-40 bg-indigo-200/60 rounded mb-3" />
        <div className="h-3 w-full bg-indigo-200/40 rounded mb-2" />
        <div className="h-3 w-2/3 bg-indigo-200/40 rounded" />
      </Card>
    );
  }

  if (!data) return null;

  const badges = [
    data.overdueTasks.length > 0 && {
      icon: ClipboardCheck,
      label: `${data.overdueTasks.length} tarefa${data.overdueTasks.length !== 1 ? "s" : ""} atrasada${data.overdueTasks.length !== 1 ? "s" : ""}`,
      className: "bg-red-100 text-red-700 border-red-200",
    },
    data.followUpDueLeads.length > 0 && {
      icon: PhoneCall,
      label: `${data.followUpDueLeads.length} para retomar contacto`,
      className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    data.hotLeadsStale.length > 0 && {
      icon: Flame,
      label: `${data.hotLeadsStale.length} lead${data.hotLeadsStale.length !== 1 ? "s" : ""} quente${data.hotLeadsStale.length !== 1 ? "s" : ""} a arrefecer`,
      className: "bg-orange-100 text-orange-700 border-orange-200",
    },
  ].filter((b): b is { icon: typeof ClipboardCheck; label: string; className: string } => !!b);

  return (
    <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-indigo-900">Assistente IA</h3>
          </div>

          {data.summary && (
            <p className="text-sm text-indigo-800 mb-3">{data.summary}</p>
          )}

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge, index) => (
                <Badge key={index} variant="outline" className={badge.className}>
                  <badge.icon className="h-3 w-3 mr-1" />
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}

          {badges.length === 0 && !data.summary && (
            <p className="text-sm text-indigo-700">Tudo em dia — sem pendências urgentes.</p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-100" onClick={() => router.push("/ai-organizer")}>
            Ver Plano Completo
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-indigo-600 hover:bg-indigo-100" onClick={() => router.push("/ai-agent")}>
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            Falar com o Agente
          </Button>
        </div>
      </div>
    </Card>
  );
}
