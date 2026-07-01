import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardCheck,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Copy,
  Mail,
  MessageCircle,
} from "lucide-react";

interface QualificationQuestion {
  key: string;
  label: string;
  question: string;
}

interface QualificationData {
  completeness: number;
  filled: number;
  total: number;
  missing: { key: string; label: string }[];
  questions: QualificationQuestion[];
}

interface LeadQualificationPanelProps {
  leadId: string;
  /** Insere o texto das perguntas selecionadas no rascunho atual (ou inicia um novo). */
  onInsertIntoDraft?: (text: string, channel: "email" | "whatsapp") => void;
}

export function LeadQualificationPanel({ leadId, onInsertIntoDraft }: LeadQualificationPanelProps) {
  const { toast } = useToast();
  const [data, setData] = useState<QualificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQualification = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!leadId) {
        throw new Error("ID da lead ausente. Não é possível analisar a qualificação.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/gpt/leads/${leadId}/qualification`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      const responseText = await res.text();

      if (!res.ok) {
        let errorMsg = `Erro do servidor (Status ${res.status})`;
        try {
          const errData = JSON.parse(responseText);
          errorMsg = errData.error || errorMsg;
        } catch {
          console.error("Resposta não-JSON recebida:", responseText.substring(0, 200));
        }
        throw new Error(errorMsg);
      }

      const parsed = JSON.parse(responseText);
      setData(parsed.qualification);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualification();
  }, [leadId]);

  const buildQuestionsText = (questions: QualificationQuestion[]): string => {
    if (questions.length === 1) return questions[0].question;
    return `Para o(a) podermos ajudar da melhor forma possível, agradecíamos que nos indicasse:\n\n${questions
      .map((q) => `- ${q.question}`)
      .join("\n")}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Pergunta copiada para a área de transferência." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-3">
        <ClipboardList className="h-8 w-8 text-indigo-400 animate-pulse" />
        <p className="text-sm text-indigo-600">A verificar dados de qualificação em falta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex flex-col items-center text-center gap-2">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" className="bg-white" onClick={fetchQualification}>
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!data) return null;

  if (data.missing.length === 0) {
    return (
      <Card className="border-emerald-100 shadow-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Lead totalmente qualificada</p>
            <p className="text-xs text-emerald-600/80">Todos os dados relevantes para esta lead estão preenchidos.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-amber-100 p-1.5 rounded-full">
            <ClipboardCheck className="h-4 w-4 text-amber-700" />
          </div>
          <h3 className="font-semibold text-sm text-amber-900">Qualificação da Lead</h3>
        </div>
        <Badge variant="outline" className="bg-white text-amber-700 border-amber-200">
          {data.completeness}% preenchido · {data.missing.length} em falta
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        {data.questions.map((q) => (
          <div key={q.key} className="flex items-start justify-between gap-3 bg-amber-50/40 border border-amber-100 rounded-lg p-3">
            <div>
              <p className="text-xs font-medium text-amber-700/80 mb-0.5">{q.label}</p>
              <p className="text-sm text-gray-800">{q.question}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
              title="Copiar pergunta"
              onClick={() => copyToClipboard(q.question)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {onInsertIntoDraft && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              onClick={() => onInsertIntoDraft(buildQuestionsText(data.questions), "email")}
            >
              <Mail className="h-3.5 w-3.5 mr-2" />
              Adicionar ao rascunho de Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => onInsertIntoDraft(buildQuestionsText(data.questions), "whatsapp")}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-2" />
              Adicionar ao rascunho de WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
