import { useState, useEffect } from "react";
import { Calendar, Mail, Phone, MessageSquare, Video, FileText, Trash2, Edit, CheckCircle, Eye, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getInteractionsByLead, deleteInteraction, type Interaction } from "@/services/interactionsService";
import { toast } from "@/hooks/use-toast";
import { InteractionEditDialog } from "@/components/InteractionEditDialog";

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  created_at: string;
  created_by?: string;
  color: string;
  icon: React.ReactNode;
  time: string;
  rawData?: Interaction;
}

interface LeadTimelineProps {
  leadId: string;
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (leadId) {
      loadTimeline();
    }
  }, [leadId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'visit': return <Eye className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      case 'status_change': return <CheckCircle className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      case 'viewing': return <Eye className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-green-100 text-green-600';
      case 'email': return 'bg-blue-100 text-blue-600';
      case 'whatsapp': return 'bg-green-100 text-green-700';
      case 'meeting': return 'bg-purple-100 text-purple-600';
      case 'visit': return 'bg-teal-100 text-teal-600';
      case 'note': return 'bg-yellow-100 text-yellow-600';
      case 'status_change': return 'bg-indigo-100 text-indigo-600';
      case 'document': return 'bg-gray-100 text-gray-600';
      case 'viewing': return 'bg-pink-100 text-pink-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const interactions = await getInteractionsByLead(leadId);
      
      const mappedEvents: TimelineEvent[] = interactions.map(interaction => ({
        id: interaction.id,
        type: interaction.interaction_type,
        title: interaction.subject || interaction.interaction_type,
        description: interaction.content || undefined,
        created_at: interaction.created_at,
        time: formatDistanceToNow(new Date(interaction.interaction_date || interaction.created_at), { addSuffix: true, locale: ptBR }),
        color: getEventColor(interaction.interaction_type),
        icon: getEventIcon(interaction.interaction_type),
        rawData: interaction,
      }));

      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error loading timeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar timeline.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditInteraction = (interaction: Interaction) => {
    setEditingInteraction(interaction);
    setShowEditDialog(true);
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta interação?")) {
      return;
    }

    try {
      await deleteInteraction(interactionId);
      
      toast({
        title: "Sucesso!",
        description: "Interação apagada com sucesso.",
      });

      await loadTimeline();
    } catch (error) {
      console.error("Error deleting interaction:", error);
      toast({
        title: "Erro",
        description: "Erro ao apagar interação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline de Atividades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">A carregar...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma atividade registada
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-4 pb-4 border-b last:border-0">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${event.color}`}>
                      {event.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 capitalize">{event.title}</p>
                          {event.description && (
                            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {event.time}
                          </Badge>
                          
                          {event.rawData && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleEditInteraction(event.rawData!)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteInteraction(event.rawData!.id)}
                                title="Apagar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <InteractionEditDialog
        interaction={editingInteraction}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={loadTimeline}
      />
    </>
  );
}