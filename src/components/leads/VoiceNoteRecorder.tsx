import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Loader2, CheckCircle2, Play, Pause, CalendarClock, ClipboardCheck, Lightbulb, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QUALIFICATION_FIELDS } from "@/lib/leadQualification";
import { supabase } from "@/integrations/supabase/client";

const QUALIFICATION_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  QUALIFICATION_FIELDS.map((field) => [field.key, field.label])
);

interface VoiceNoteRecorderProps {
  leadId: string;
  leadName: string;
  currentStatus: string;
  currentTemperature: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Resultado da análise automática aplicada pelo servidor — ver
 * AppliedAutoAnalysis em src/lib/server/leadAutoAnalysis.ts.
 */
interface AppliedAnalysis {
  summary: string;
  temperature?: { from: string; to: string };
  status?: { from: string; to: string };
  qualification_fields: string[];
  tasks_created: string[];
  agenda_blocks_pending: string[];
  next_actions: string[];
}

interface ProcessResult {
  transcription: string;
  analysis: AppliedAnalysis | null;
  analysisSkippedReason: string | null;
}

export function VoiceNoteRecorder({
  leadId,
  leadName,
  onSuccess,
  onCancel,
}: VoiceNoteRecorderProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Erro ao gravar",
        description: "Não foi possível aceder ao microfone. Verifique as permissões do browser.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const processAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Inicie sessão novamente.");

      const formData = new FormData();
      formData.append("audio", audioBlob, "voice-note.webm");

      // Tudo automático no servidor: transcreve, grava a transcrição nas
      // notas da lead, regista a interação e corre a análise de IA
      // (temperatura, tarefas, blocos de agenda "por confirmar").
      const response = await fetch(`/api/gpt/leads/${leadId}/voice-note`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || "Erro ao processar nota de voz");
      }

      const processResult: ProcessResult = await response.json();
      setResult(processResult);

      toast({
        title: "✅ Nota de voz processada",
        description: "Transcrição gravada nas notas da lead.",
      });
    } catch (error: any) {
      console.error("Error processing audio:", error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Ocorreu um erro ao processar a nota de voz.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: "Novo",
      contacted: "Contactado",
      qualified: "Qualificado",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Ganho",
      lost: "Perdido",
    };
    return labels[status] || status;
  };

  const getTemperatureLabel = (temp: string) => {
    const labels: Record<string, string> = {
      hot: "🔥 Quente",
      warm: "⚠️ Morna",
      cold: "❄️ Fria",
    };
    return labels[temp] || temp;
  };

  const analysis = result?.analysis || null;

  return (
    <div className="space-y-4">
      {!audioBlob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-indigo-600" />
              Gravar Nota de Voz
            </CardTitle>
            <CardDescription>
              Grave uma nota após a visita ou contacto com {leadName}. A transcrição é gravada
              automaticamente nas notas da lead e a IA aplica as atualizações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-8">
              {isRecording && (
                <div className="text-4xl font-bold text-red-600 animate-pulse">
                  {formatTime(recordingTime)}
                </div>
              )}

              <Button
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                className={isRecording ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}
              >
                {isRecording ? (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Parar Gravação
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Iniciar Gravação
                  </>
                )}
              </Button>

              {!isRecording && (
                <p className="text-sm text-gray-500">
                  Prima para começar a gravar. Fale naturalmente sobre a interação.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {audioBlob && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Gravação Concluída</CardTitle>
            <CardDescription>
              Duração: {formatTime(recordingTime)} | Oiça a gravação e processe quando estiver pronto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={togglePlayback} disabled={isProcessing}>
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Ouvir
                  </>
                )}
              </Button>

              <Button
                onClick={processAudio}
                disabled={isProcessing}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A processar...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Processar Nota
                  </>
                )}
              </Button>
            </div>

            <Button variant="outline" onClick={startRecording} disabled={isProcessing} className="w-full">
              <Mic className="h-4 w-4 mr-2" />
              Gravar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              O que a IA fez
            </CardTitle>
            <CardDescription>
              A transcrição foi gravada nas notas da lead e as atualizações abaixo já foram aplicadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transcription */}
            <div>
              <h4 className="font-semibold mb-2 text-sm text-gray-700">📝 Transcrição (gravada nas notas)</h4>
              <p className="text-sm bg-gray-50 p-3 rounded border italic">&quot;{result.transcription}&quot;</p>
            </div>

            {!analysis && (
              <div className="text-sm bg-amber-50 border border-amber-200 rounded p-3 text-amber-800">
                {result.analysisSkippedReason === "toggle_desligado"
                  ? "A análise automática de IA está desligada nas Definições — apenas a transcrição foi gravada."
                  : "A análise de IA não foi executada (a transcrição foi gravada na mesma)."}
              </div>
            )}

            {analysis && (
              <>
                <Separator />

                {/* Summary */}
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-gray-700">📋 Resumo da Interação</h4>
                  <p className="text-sm bg-indigo-50 p-3 rounded border">{analysis.summary}</p>
                </div>

                {/* Status Change */}
                {analysis.status && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-gray-700">🎯 Status atualizado</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getStatusLabel(analysis.status.from)}</Badge>
                      <span className="text-gray-400">→</span>
                      <Badge className="bg-indigo-600">{getStatusLabel(analysis.status.to)}</Badge>
                    </div>
                  </div>
                )}

                {/* Temperature Change */}
                {analysis.temperature && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-gray-700">🌡️ Temperatura atualizada</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getTemperatureLabel(analysis.temperature.from)}</Badge>
                      <span className="text-gray-400">→</span>
                      <Badge className="bg-indigo-600">{getTemperatureLabel(analysis.temperature.to)}</Badge>
                    </div>
                  </div>
                )}

                {/* Tasks created */}
                {analysis.tasks_created.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-gray-700 flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4 text-green-600" />
                      Tarefas criadas
                    </h4>
                    <ul className="bg-green-50 border border-green-100 rounded p-3 space-y-1 text-sm list-disc list-inside">
                      {analysis.tasks_created.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Agenda blocks pending confirmation */}
                {analysis.agenda_blocks_pending.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-gray-700 flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-amber-600" />
                      Blocos na agenda (por confirmar)
                    </h4>
                    <ul className="bg-amber-50 border border-amber-100 rounded p-3 space-y-1 text-sm list-disc list-inside">
                      {analysis.agenda_blocks_pending.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Confirme ou rejeite estes blocos no Calendário.
                    </p>
                  </div>
                )}

                {/* Qualification fields filled */}
                {analysis.qualification_fields.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-gray-700 flex items-center gap-1.5">
                      <ClipboardCheck className="h-4 w-4 text-amber-600" />
                      Dados de qualificação preenchidos
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.qualification_fields.map((key) => (
                        <Badge key={key} variant="outline">{QUALIFICATION_FIELD_LABELS[key] || key}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next actions */}
                {analysis.next_actions.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-gray-700 flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-indigo-600" />
                      Sugestões de próximas ações
                    </h4>
                    <ul className="bg-indigo-50 border border-indigo-100 rounded p-3 space-y-1 text-sm list-disc list-inside">
                      {analysis.next_actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <Separator />

            <Button onClick={onSuccess} className="w-full bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Concluir
            </Button>
          </CardContent>
        </Card>
      )}

      {!result && (
        <Button variant="ghost" onClick={onCancel} disabled={isProcessing || isRecording} className="w-full">
          Cancelar
        </Button>
      )}
    </div>
  );
}
