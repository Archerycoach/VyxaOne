import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link as LinkIcon, Check, Loader2 } from "lucide-react";
import { getOrCreateBookingLink } from "@/services/bookingService";

/**
 * Copia o link de agendamento do consultor.
 *
 * O link é o mesmo em toda a aplicação (um por consultor) — está disponível na
 * Agenda, nos Imóveis e nos Empreendimentos para poder ser partilhado no
 * momento em que se está a falar com o cliente sobre um imóvel, sem ter de
 * navegar até à Agenda.
 */

interface BookingLinkButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  /** Texto do botão. Em ecrãs pequenos só aparece o ícone. */
  label?: string;
  className?: string;
}

export function BookingLinkButton({
  variant = "outline",
  size = "default",
  label = "Link de Reservas",
  className,
}: BookingLinkButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    setLoading(true);
    try {
      const link = await getOrCreateBookingLink();
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast({
        title: "Link copiado",
        description: "Partilha com o cliente para ele reservar um horário contigo.",
      });
    } catch (error) {
      console.error("[BookingLinkButton] Erro ao copiar o link:", error);
      toast({
        title: "Erro ao copiar o link",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleCopy} disabled={loading} className={className}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : copied ? (
        <Check className="mr-2 h-4 w-4 text-green-600" />
      ) : (
        <LinkIcon className="mr-2 h-4 w-4" />
      )}
      <span className="hidden sm:inline">{copied ? "Copiado!" : label}</span>
    </Button>
  );
}
