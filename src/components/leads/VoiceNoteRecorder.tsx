import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface VoiceNoteRecorderProps {
  leadId: string;
  leadName: string;
  currentStatus: string;
  currentTemperature: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface AnalysisResult {
  summary: string;
  suggested_status: string;
  suggested_temperature: string;
  suggested_task: {
    title: string;
    description: string;
    due_date: string;
    priority: string;
  } | null;
  confidence: number;
}

export function VoiceNoteRecorder({
  leadId,
  leadName,
  currentStatus,
  currentTemperature,
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
  const [transcription, setTranscription] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

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
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice-note.webm");

      const response = await fetch(`/api/gpt/leads/${leadId}/voice-note`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao processar nota de voz");
      }

      const result = await response.json();
      setTranscription(result.transcription);
      setAnalysis(result.analysis);

      toast({
        title: "✅ Nota processada",
        description: "Reveja as alterações sugeridas antes de confirmar.",
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

  const confirmChanges = async () => {
    if (!analysis) return;

    setIsConfirming(true);

    try {
      const response = await fetch(`/api/gpt/leads/${leadId}/voice-note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription,
          analysis,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao aplicar alterações");
      }

      toast({
        title: "✅ Lead atualizada",
        description: "Todas as alterações foram aplicadas com sucesso!",
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error confirming changes:", error);
      toast({
        title: "Erro ao confirmar",
        description: error.message || "Ocorreu um erro ao aplicar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
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
              Grave uma nota após a visita ou contacto com {leadName}. A IA irá analisar e sugerir
              atualizações automáticas.
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

      {audioBlob && !analysis && (
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

      {analysis && (
        <Card className="border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Análise da Nota de Voz
            </CardTitle>
            <CardDescription>
              Reveja as alterações sugeridas pela IA antes de confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transcription */}
            <div>
              <h4 className="font-semibold mb-2 text-sm text-gray-700">📝 Transcrição</h4>
              <p className="text-sm bg-gray-50 p-3 rounded border italic">&quot;{transcription}&quot;</p>
            </div>

            <Separator />

            {/* Summary */}
            <div>
              <h4 className="font-semibold mb-2 text-sm text-gray-700">📋 Resumo da Interação</h4>
              <p className="text-sm bg-indigo-50 p-3 rounded border">{analysis.summary}</p>
            </div>

            <Separator />

            {/* Status Change */}
            <div>
              <h4 className="font-semibold mb-2 text-sm text-gray-700">🎯 Mudança de Status</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{getStatusLabel(currentStatus)}</Badge>
                <span className="text-gray-400">→</span>
                <Badge className="bg-indigo-600">{getStatusLabel(analysis.suggested_status)}</Badge>
              </div>
            </div>

            {/* Temperature Change */}
            <div>
              <h4 className="font-semibold mb-2 text-sm text-gray-700">🌡️ Temperatura</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{getTemperatureLabel(currentTemperature)}</Badge>
                <span className="text-gray-400">→</span>
                <Badge className="bg-indigo-600">{getTemperatureLabel(analysis.suggested_temperature)}</Badge>
              </div>
            </div>

            {/* Suggested Task */}
            {analysis.suggested_task && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-gray-700">✅ Próxima Tarefa</h4>
                  <div className="bg-green-50 p-3 rounded border space-y-2">
                    <p className="font-medium text-sm">{analysis.suggested_task.title}</p>
                    <p className="text-sm text-gray-600">{analysis.suggested_task.description}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">
                        📅 {new Date(analysis.suggested_task.due_date).toLocaleDateString("pt-PT")}
                      </Badge>
                      <Badge
                        variant={
                          analysis.suggested_task.priority === "urgent"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        Prioridade: {analysis.suggested_task.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Confidence */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Confiança da IA</span>
              <Badge variant={analysis.confidence >= 0.8 ? "default" : "outline"}>
                {(analysis.confidence * 100).toFixed(0)}%
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onCancel} disabled={isConfirming} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={confirmChanges}
                disabled={isConfirming}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A aplicar...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Alterações
                  </>
                )}
              </Button>
            </div>

            {analysis.confidence < 0.7 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-yellow-800">
                  A confiança da IA é moderada. Reveja cuidadosamente as alterações antes de confirmar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}