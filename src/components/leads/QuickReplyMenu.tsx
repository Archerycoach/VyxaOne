import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Zap, Mail, MessageCircle } from "lucide-react";
import {
  getMessageSnippets,
  personalizeSnippet,
  type MessageSnippet,
} from "@/services/messageSnippetsService";
import { createInteraction } from "@/services/interactionsService";
import { useToast } from "@/hooks/use-toast";

interface QuickReplyLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * Respostas rápidas na ficha da lead.
 *
 * Escolher uma resposta abre a aplicação certa — WhatsApp com o texto já
 * escrito, ou o email — e regista a interação com o tipo correspondente.
 * O envio em si acontece na aplicação externa; o que fica garantido aqui é
 * que a cronologia mostra que a resposta seguiu, e por que canal.
 */
export function QuickReplyMenu({
  lead,
  onLogged,
}: {
  lead: QuickReplyLead;
  onLogged: () => void;
}) {
  const { toast } = useToast();
  const [snippets, setSnippets] = useState<MessageSnippet[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Carrega só quando o menu existe no ecrã — a maioria das aberturas da
    // ficha nem chega a usar respostas rápidas.
    getMessageSnippets()
      .then(setSnippets)
      .catch(() => setSnippets([]))
      .finally(() => setLoaded(true));
  }, []);

  const send = async (snippet: MessageSnippet, channel: "whatsapp" | "email") => {
    const text = personalizeSnippet(snippet.content, {
      name: lead.name,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
    });

    if (channel === "whatsapp") {
      if (!lead.phone) {
        toast({ title: "A lead não tem telefone registado", variant: "destructive" });
        return;
      }
      const phone = lead.phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
    } else {
      if (!lead.email) {
        toast({ title: "A lead não tem email registado", variant: "destructive" });
        return;
      }
      const subject = snippet.title || "Contacto";
      window.open(
        `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
        "_blank"
      );
    }

    // Regista JÁ, com o texto enviado: se se esperasse por confirmação do
    // envio externo (que não existe), a cronologia ficava sem rasto nenhum.
    try {
      await createInteraction({
        lead_id: lead.id,
        interaction_type: channel,
        content: `Resposta rápida "${snippet.title}": ${text}`,
        interaction_date: new Date().toISOString(),
      });
      onLogged();
      toast({
        title: channel === "whatsapp" ? "WhatsApp aberto" : "Email aberto",
        description: "A interação ficou registada na cronologia.",
      });
    } catch (error: any) {
      toast({
        title: "Aplicação aberta, mas o registo falhou",
        description: error?.message || "Regista a interação manualmente.",
        variant: "destructive",
      });
    }
  };

  // "both" aparece nas duas secções — o clique decide o canal.
  const whatsappSnippets = snippets.filter((s) => s.channel === "whatsapp" || s.channel === "both");
  const emailSnippets = snippets.filter((s) => s.channel === "email" || s.channel === "both");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Zap className="h-4 w-4 mr-2 text-amber-500" />
          Resposta rápida
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {!loaded && <DropdownMenuLabel>A carregar...</DropdownMenuLabel>}

        {loaded && snippets.length === 0 && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Sem respostas rápidas. Cria-as em Definições → Respostas Rápidas.
          </DropdownMenuLabel>
        )}

        {whatsappSnippets.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-green-700">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </DropdownMenuLabel>
            {whatsappSnippets.map((snippet) => (
              <DropdownMenuItem key={`w-${snippet.id}`} onClick={() => send(snippet, "whatsapp")}>
                <span className="truncate">{snippet.title}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {whatsappSnippets.length > 0 && emailSnippets.length > 0 && <DropdownMenuSeparator />}

        {emailSnippets.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-blue-700">
              <Mail className="h-3.5 w-3.5" /> Email
            </DropdownMenuLabel>
            {emailSnippets.map((snippet) => (
              <DropdownMenuItem key={`e-${snippet.id}`} onClick={() => send(snippet, "email")}>
                <span className="truncate">{snippet.title}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
