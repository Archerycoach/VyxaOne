import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, Bot, User, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComposeLead {
  id: string;
  name: string;
  email?: string | null;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

/**
 * Compositor de email por IA para UMA lead: o consultor conversa com a IA para
 * definir o TEMA; a IA faz perguntas de clarificação e, quando tem o essencial,
 * propõe um rascunho (assunto + corpo) editável. O consultor revê e envia — nada
 * é enviado sozinho. Reutiliza /api/smtp/send (regista a interação na cronologia).
 */
export function LeadComposeEmailDialog({
  lead,
  open,
  onOpenChange,
  onSent,
}: {
  lead: ComposeLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const firstName = lead.name?.split(" ")[0] || "a lead";
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reinicia a conversa sempre que abre.
  useEffect(() => {
    if (open) {
      setMessages([{ role: "assistant", content: `Sobre o que quer escrever a ${firstName}? Diga-me o tema (ex.: seguimento de visita, envio de documento, proposta) e eu trato do resto.` }]);
      setInput(""); setSubject(""); setBody(""); setHasDraft(false);
    }
  }, [open, firstName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = async () => {
    const text = input.trim();
    if (!text || loading) return;
    // A IA só recebe user/assistant reais (não a saudação inicial local).
    const convo = messages.filter((m, i) => !(i === 0 && m.role === "assistant"));
    const next: ChatMsg[] = [...convo, { role: "user", content: text }];
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/gpt/leads/${lead.id}/compose-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao compor o email.");
      setMessages((m) => [...m, { role: "assistant", content: d.reply || "" }]);
      if (d.ready && d.subject && d.html) {
        setSubject(d.subject);
        setBody(d.html);
        setHasDraft(true);
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
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
      const res = await fetch("/api/smtp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ to: lead.email, subject, html: body, text: body.replace(/<[^>]*>?/gm, ""), leadId: lead.id }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.message || d.error || "Falha no envio.");
      toast({ title: "✅ Email enviado", description: `Enviado para ${lead.email} e registado na cronologia.` });
      onSent?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-indigo-600" /> Escrever email com IA — {firstName}
          </DialogTitle>
        </DialogHeader>

        {/* Conversa */}
        <ScrollArea className="flex-1 pr-3" style={{ maxHeight: hasDraft ? "28vh" : "48vh" }}>
          <div ref={scrollRef} className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-2 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${m.role === "user" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"}`}>
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start"><div className="rounded-2xl bg-gray-100 px-3 py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-500" /></div></div>
            )}
          </div>
        </ScrollArea>

        {/* Entrada de conversa */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
            placeholder={hasDraft ? "Pedir alterações ao rascunho…" : "Escreva o tema do email…"}
            disabled={loading}
          />
          <Button onClick={ask} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>

        {/* Rascunho (quando pronto) */}
        {hasDraft && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">Rascunho — reveja e edite antes de enviar (nada é enviado automaticamente):</p>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="font-mono text-xs" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={send} disabled={sending || !subject.trim() || !body.trim() || !lead.email}>
                {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Enviar a {firstName}
              </Button>
            </div>
            {!lead.email && <p className="text-xs text-red-600 text-right">A lead não tem email registado.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
