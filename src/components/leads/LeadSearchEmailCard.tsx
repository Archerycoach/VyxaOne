import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LeadSearchEmailLead {
  id: string;
  name: string;
  email?: string | null;
}

/**
 * Email por procura, para ESTA lead, a partir da ficha dela.
 *
 * A IA cruza a procura da lead com a carteira e propõe um email pessoal com
 * os imóveis compatíveis. O consultor revê e edita antes de enviar — o texto
 * proposto nunca sai sozinho. O envio segue pelo /api/smtp/send normal, que
 * regista a interação na cronologia.
 */
export function LeadSearchEmailCard({
  lead,
  onSent,
}: {
  lead: LeadSearchEmailLead;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [matches, setMatches] = useState<Array<{ title: string; score: number | null }>>([]);
  const [hasDraft, setHasDraft] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/gpt/leads/search-email-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao gerar o email.");

      if (data.noMatches) {
        toast({ title: "Sem imóveis compatíveis", description: data.message });
        return;
      }

      setSubject(data.subject);
      setBody(data.html);
      setMatches(data.matches || []);
      setHasDraft(true);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!lead.email) {
      toast({ title: "A lead não tem email registado", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/smtp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          to: lead.email,
          subject,
          html: body,
          text: body.replace(/<[^>]*>?/gm, ""),
          leadId: lead.id,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Falha no envio.");
      }

      toast({
        title: "✅ Email enviado",
        description: `Enviado para ${lead.email} e registado na cronologia.`,
      });
      setHasDraft(false);
      setSubject("");
      setBody("");
      onSent();
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-indigo-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-indigo-900">
          <Home className="h-4 w-4" />
          Email por procura para esta lead
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          A IA cruza a procura desta lead com a tua carteira e propõe um email pessoal com os
          imóveis compatíveis. Revês e editas antes de enviar.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasDraft ? (
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A cruzar procura e carteira...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar proposta de email
              </>
            )}
          </Button>
        ) : (
          <>
            {matches.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Imóveis incluídos:{" "}
                {matches
                  .map((m) => `${m.title}${m.score ? ` (${m.score}%)` : ""}`)
                  .join(" · ")}
              </p>
            )}
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button onClick={send} disabled={sending || !subject.trim() || !body.trim()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar a {lead.name.split(" ")[0]}
              </Button>
              <Button variant="outline" onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar outra versão"}
              </Button>
              <Button variant="ghost" onClick={() => setHasDraft(false)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
