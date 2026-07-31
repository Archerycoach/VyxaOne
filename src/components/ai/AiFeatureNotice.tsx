import Link from "next/link";
import { Sparkles, KeyRound, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiAvailability } from "@/hooks/useAiAvailability";

/**
 * Aviso reutilizável para funcionalidades que EXIGEM IA. Aparece SÓ quando a IA
 * não está ativa para o consultor (sem chave pessoal e sem plano com IA
 * integrada). Quando está ativa, não renderiza nada.
 *
 * Comunica as DUAS formas de ativar: configurar a chave própria, ou subscrever
 * um plano com IA integrada (chave da agência).
 */
export function AiFeatureNotice({ feature, className = "" }: { feature?: string; className?: string }) {
  const { available, loading } = useAiAvailability();

  // Enquanto verifica, ou se está disponível, não mostra nada (não pisca).
  if (loading || available) return null;

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-1.5">
          <Sparkles className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-900">
            {feature ? `${feature} usa IA` : "Esta funcionalidade usa IA"} — ainda não está ativa na sua conta
          </p>
          <p className="text-sm text-amber-800 mt-0.5">
            Ative a IA de uma de duas formas: configure a <strong>sua própria chave</strong> de IA, ou subscreva um
            <strong> plano com IA integrada</strong> (nesse caso a chave é da agência, sem configuração da sua parte).
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link href="/settings?tab=gpt-agent">
              <Button size="sm" variant="outline" className="border-amber-300 bg-white">
                <KeyRound className="h-4 w-4 mr-1.5" /> Configurar a minha chave
              </Button>
            </Link>
            <Link href="/subscription">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                <CreditCard className="h-4 w-4 mr-1.5" /> Ver planos com IA
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
