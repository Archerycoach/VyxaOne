import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Phone,
  Edit,
  Trash2,
  Calendar,
  Gift,
  MessageSquare,
  MessageCircle,
  FileText,
  Eye,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContactsTableProps {
  contacts: any[];
  loading: boolean;
  onEdit: (contact: any) => void;
  onDelete: (id: string) => void;
  onViewDetails: (contact: any) => void;
  onTaskClick: (contact: any) => void;
  onEventClick: (contact: any) => void;
  onInteractionClick: (contact: any) => void;
  onConfigureAutoMessages: (contact: any) => void;
}

export function ContactsTable({
  contacts,
  loading,
  onEdit,
  onDelete,
  onViewDetails,
  onTaskClick,
  onEventClick,
  onInteractionClick,
  onConfigureAutoMessages,
}: ContactsTableProps) {
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  };

  const handleEmailClick = (contact: any) => {
    if (!contact.email) {
      toast({
        title: "Sem email",
        description: "Este contacto não tem email.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = `mailto:${contact.email}`;
  };

  const handleSMSClick = (contact: any) => {
    if (!contact.phone) {
      toast({
        title: "Sem telefone",
        description: "Este contacto não tem telefone.",
        variant: "destructive",
      });
      return;
    }
    const cleanPhone = contact.phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("351") ? cleanPhone : `351${cleanPhone}`;
    window.location.href = `sms:+${phoneWithCountry}`;
  };

  const handleWhatsAppClick = (contact: any) => {
    if (!contact.phone) {
      toast({
        title: "Sem telefone",
        description: "Este contacto não tem telefone.",
        variant: "destructive",
      });
      return;
    }
    const cleanPhone = contact.phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("351") ? cleanPhone : `351${cleanPhone}`;
    window.open(`https://wa.me/${phoneWithCountry}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Aniversário</TableHead>
          <TableHead>Automação</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              Nenhum contacto encontrado
            </TableCell>
          </TableRow>
        ) : (
          contacts.map((contact) => (
            <TableRow key={contact.id} className="hover:bg-gray-50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {contact.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {contact.name}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm space-y-1">
                  {contact.phone && (
                    <span className="flex items-center gap-1 text-gray-600">
                      <Phone className="h-3 w-3" /> {contact.phone}
                    </span>
                  )}
                  {contact.email && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <Mail className="h-3 w-3" /> {contact.email}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {contact.birth_date ? (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(contact.birth_date)}
                  </span>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {contact.auto_message_config?.birthday_enabled && (
                  <Badge variant="secondary" className="text-xs">
                    <Gift className="h-3 w-3 mr-1" />
                    Aniversário
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetails(contact)}
                    className="hover:bg-cyan-50 text-cyan-600"
                    title="Ver Detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onTaskClick(contact)}
                    className="hover:bg-blue-50 text-blue-600"
                    title="Nova Tarefa"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEventClick(contact)}
                    className="hover:bg-purple-50 text-purple-600"
                    title="Novo Evento"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEmailClick(contact)}
                    className="hover:bg-purple-50 text-purple-600"
                    title="Enviar Email"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSMSClick(contact)}
                    className="hover:bg-orange-50 text-orange-600"
                    title="Enviar SMS"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleWhatsAppClick(contact)}
                    className="hover:bg-green-50 text-green-600"
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onInteractionClick(contact)}
                    className="hover:bg-indigo-50 text-indigo-600"
                    title="Nova Interação"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onConfigureAutoMessages(contact)}
                    className="hover:bg-blue-50"
                    title="Configurar Mensagens Automáticas"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(contact)}
                    className="hover:bg-gray-100"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(contact.id)}
                    className="hover:bg-red-50 text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}