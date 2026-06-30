import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  MessageCircle,
  Mic,
  FileText,
  CheckSquare,
  Phone,
  Calendar,
  Filter,
  User,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InteractionWithDetails } from "@/services/interactionsService";
import type { LeadNote } from "@/services/notesService";
import type { Task } from "@/types";

interface LeadTimelineProps {
  interactions: InteractionWithDetails[];
  notes: LeadNote[];
  tasks: Task[];
}

type TimelineItemType = "email" | "whatsapp" | "voice_note" | "note" | "task" | "call" | "visit";

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  date: Date;
  content: string;
  author?: string;
  direction?: "inbound" | "outbound";
  channel?: string;
  originalData: any;
}

const channelIcons: Record<TimelineItemType, any> = {
  email: Mail,
  whatsapp: MessageCircle,
  voice_note: Mic,
  note: FileText,
  task: CheckSquare,
  call: Phone,
  visit: Calendar,
};

const channelColors: Record<TimelineItemType, string> = {
  email: "bg-blue-100 text-blue-700 border-blue-200",
  whatsapp: "bg-green-100 text-green-700 border-green-200",
  voice_note: "bg-purple-100 text-purple-700 border-purple-200",
  note: "bg-gray-100 text-gray-700 border-gray-200",
  task: "bg-orange-100 text-orange-700 border-orange-200",
  call: "bg-cyan-100 text-cyan-700 border-cyan-200",
  visit: "bg-pink-100 text-pink-700 border-pink-200",
};

const channelLabels: Record<TimelineItemType, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  voice_note: "Nota de Voz",
  note: "Nota",
  task: "Tarefa",
  call: "Chamada",
  visit: "Visita",
};

export function LeadTimeline({ interactions, notes, tasks }: LeadTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<TimelineItemType | "all">("all");

  // Consolidar todas as interações numa timeline unificada
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Adicionar interações
    interactions.forEach(interaction => {
      let type: TimelineItemType = "email";
      let content = interaction.content || "";

      // Determinar tipo baseado no interaction type
      if (interaction.interaction_type === "email") {
        type = "email";
        content = interaction.content || "";
      } else if (interaction.interaction_type === "whatsapp_outbound" || interaction.interaction_type === "whatsapp_inbound") {
        type = "whatsapp";
        content = interaction.content || "";
      } else if (interaction.interaction_type === "voice_note") {
        type = "voice_note";
        content = interaction.content || "";
      } else if (interaction.interaction_type === "call") {
        type = "call";
        content = interaction.content || "";
      } else if (interaction.interaction_type === "visit") {
        type = "visit";
        content = interaction.content || "";
      }

      const direction = interaction.interaction_type?.includes("inbound") ? "inbound" : "outbound";

      items.push({
        id: `interaction-${interaction.id}`,
        type,
        date: parseISO(interaction.created_at),
        content,
        author: (interaction as any).user?.name || "Sistema",
        direction,
        channel: interaction.interaction_type || "",
        originalData: interaction,
      });
    });

    // Adicionar notas
    notes.forEach(note => {
      items.push({
        id: `note-${note.id}`,
        type: "note",
        date: parseISO(note.created_at),
        content: note.note || "",
        author: (note as any).user?.name || "Sistema",
        originalData: note,
      });
    });

    // Adicionar tarefas concluídas
    tasks
      .filter(task => task.status === "completed" || task.completed)
      .forEach(task => {
        items.push({
          id: `task-${task.id}`,
          type: "task",
          date: task.createdAt ? parseISO(task.createdAt) : new Date(),
          content: task.title || "",
          author: "Sistema",
          originalData: task,
        });
      });

    // Ordenar por data (mais recente primeiro)
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [interactions, notes, tasks]);

  // Filtrar items baseado no filtro ativo
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return timelineItems;
    return timelineItems.filter(item => item.type === activeFilter);
  }, [timelineItems, activeFilter]);

  // Contar items por tipo
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: timelineItems.length,
      email: 0,
      whatsapp: 0,
      voice_note: 0,
      note: 0,
      task: 0,
      call: 0,
      visit: 0,
    };

    timelineItems.forEach(item => {
      c[item.type]++;
    });

    return c;
  }, [timelineItems]);

  const filterButtons: Array<{ key: TimelineItemType | "all"; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "email", label: "E-mail" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "voice_note", label: "Voz" },
    { key: "note", label: "Notas" },
    { key: "call", label: "Chamadas" },
    { key: "visit", label: "Visitas" },
    { key: "task", label: "Tarefas" },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap bg-gray-50 p-3 rounded-lg border">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-600">Filtrar por:</span>
        {filterButtons.map(({ key, label }) => {
          const count = counts[key] || 0;
          if (count === 0 && key !== "all") return null;

          return (
            <Button
              key={key}
              size="sm"
              variant={activeFilter === key ? "default" : "outline"}
              onClick={() => setActiveFilter(key)}
              className="h-8"
            >
              {label}
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-5 min-w-[20px] text-xs">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma interação encontrada</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeFilter !== "all" 
                ? `Sem registos de ${channelLabels[activeFilter as TimelineItemType]?.toLowerCase() || activeFilter}` 
                : "Ainda não há interações registadas"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, index) => {
            const Icon = channelIcons[item.type];
            const isLastItem = index === filteredItems.length - 1;

            return (
              <div key={item.id} className="relative">
                {/* Linha vertical conectando items (exceto último) */}
                {!isLastItem && (
                  <div className="absolute left-[19px] top-10 bottom-[-12px] w-0.5 bg-gray-200" />
                )}

                <Card className="border-l-4" style={{ borderLeftColor: channelColors[item.type].split(" ")[0].replace("bg-", "") }}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Ícone do canal */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${channelColors[item.type]}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className={channelColors[item.type]}>
                            {channelLabels[item.type]}
                          </Badge>

                          {item.direction && (
                            <Badge variant="secondary" className="text-xs">
                              {item.direction === "inbound" ? "📥 Recebido" : "📤 Enviado"}
                            </Badge>
                          )}

                          <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
                            <User className="h-3 w-3" />
                            <span>{item.author}</span>
                          </div>
                        </div>

                        {/* Conteúdo da mensagem/nota */}
                        <div className="text-sm text-gray-700 mb-2 whitespace-pre-wrap break-words">
                          {item.content.length > 300 
                            ? `${item.content.substring(0, 300)}...` 
                            : item.content}
                        </div>

                        {/* Footer - Data */}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          <time dateTime={item.date.toISOString()}>
                            {format(item.date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </time>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}