import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Cake, FileDown, Plus, Upload, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ContactsTable } from "./ContactsTable";
import { ContactFilters } from "./ContactFilters";
import { ContactDialogs } from "./ContactDialogs";
import {
  useContacts,
  useContactFilters,
  useContactMutations,
  useContactInteractions,
} from "../hooks";
import type { InteractionWithDetails } from "@/services/interactionsService";

export function ContactsContainer() {
  const { toast } = useToast();

  // Hooks
  const {
    contacts,
    upcomingBirthdays,
    loading,
    error,
    refetch,
  } = useContacts();

  const { searchTerm, setSearchTerm, filteredContacts } = useContactFilters(contacts);

  const {
    submitting,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleConfigureAutoMessages,
  } = useContactMutations(refetch);

  const {
    loading: loadingInteractions,
    interactions: contactInteractions,
    createContactInteraction,
    loadContactInteractions,
  } = useContactInteractions();

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoMessageDialogOpen, setAutoMessageDialogOpen] = useState(false);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Form states
  const [editingContact, setEditingContact] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birth_date: "",
    notes: "",
  });

  const [autoMessageConfig, setAutoMessageConfig] = useState<{
    birthday_enabled: boolean;
    custom_dates: Array<{ date: string; message: string; enabled: boolean }>;
  }>({
    birthday_enabled: false,
    custom_dates: [],
  });

  const [interactionForm, setInteractionForm] = useState({
    type: "call" as "call" | "email" | "whatsapp" | "meeting" | "note" | "sms" | "video_call" | "visit",
    subject: "",
    content: "",
    outcome: "",
    interaction_date: "",
  });

  // Import state
  const [importing, setImporting] = useState(false);
  
  // Business card state
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [extractedContact, setExtractedContact] = useState<any>(null);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Handlers
  const handleNewContact = () => {
    setEditingContact(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      birth_date: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      birth_date: contact.birth_date || "",
      notes: contact.notes || "",
    });
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      await handleUpdate(editingContact.id, formData);
    } else {
      await handleCreate(formData);
    }
    setDialogOpen(false);
  };

  const handleDeleteContact = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este contacto?")) {
      await handleDelete(id);
    }
  };

  const handleConfigureAutoMessagesClick = (contact: any) => {
    setSelectedContact(contact);
    setAutoMessageConfig({
      birthday_enabled: contact.auto_message_config?.birthday_enabled || false,
      custom_dates: contact.auto_message_config?.custom_dates || [],
    });
    setAutoMessageDialogOpen(true);
  };

  const handleSaveAutoMessages = async () => {
    if (!selectedContact) return;
    await handleConfigureAutoMessages(selectedContact.id, autoMessageConfig);
    setAutoMessageDialogOpen(false);
  };

  const handleViewDetails = async (contact: any) => {
    setSelectedContact(contact);
    setDetailsDialogOpen(true);
    await loadContactInteractions(contact.id);
  };

  const handleNewInteractionClick = () => {
    setInteractionForm({
      type: "call",
      subject: "",
      content: "",
      outcome: "",
      interaction_date: "",
    });
    setDetailsDialogOpen(false);
    setInteractionDialogOpen(true);
  };

  const handleCreateInteraction = async () => {
    if (!selectedContact) return;
    await createContactInteraction(selectedContact.id, {
      ...interactionForm,
      interaction_date: interactionForm.interaction_date ? new Date(interactionForm.interaction_date).toISOString() : undefined
    });
    setInteractionDialogOpen(false);
    if (detailsDialogOpen) {
      await loadContactInteractions(selectedContact.id);
    }
  };

  const handleExport = async () => {
    try {
      // TODO: Re-enable when exportToExcel is available in excelService
      toast({ title: "Funcionalidade em desenvolvimento" });
      /*
      await exportToExcel(
        filteredContacts.map((c) => ({
          Nome: c.name,
          Email: c.email || "-",
          Telefone: c.phone || "-",
          Aniversário: c.birth_date || "-",
          Notas: c.notes || "-",
        })),
        "contactos"
      );
      toast({ title: "Contactos exportados com sucesso" });
      */
    } catch (error) {
      console.error("Error exporting contacts:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar os contactos",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      // TODO: Re-enable when importFromExcel is available in excelService
      toast({ title: "Funcionalidade em desenvolvimento" });
      /*
      const data = await importFromExcel(file);
      const contactsData = data.map((row: any) => ({
        name: row.Nome || row.name,
        email: row.Email || row.email,
        phone: row.Telefone || row.phone,
        birth_date: row.Aniversário || row.birth_date,
        notes: row.Notas || row.notes,
      }));

      for (const contact of contactsData) {
        if (contact.name) {
          await handleCreate(contact);
        }
      }

      toast({ title: `${contactsData.length} contactos importados com sucesso` });
      */
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast({
        title: "Erro ao importar",
        description: "Não foi possível importar os contactos",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleCardImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({ title: "Erro", description: "Por favor selecione uma imagem", variant: "destructive" });
      return;
    }

    // Converter para base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setCardImage(reader.result as string);
      extractContactFromCard(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = "";
  };

  const extractContactFromCard = async (imageBase64: string) => {
    setExtracting(true);
    setShowCardDialog(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gpt/contacts/extract-from-card", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ imageBase64 })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setExtractedContact(data.contact);
      toast({ title: "Dados extraídos", description: "Reveja os dados antes de guardar" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setShowCardDialog(false);
      setCardImage(null);
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveExtractedContact = async () => {
    if (!extractedContact) return;
    await handleCreate(extractedContact);
    setShowCardDialog(false);
    setCardImage(null);
    setExtractedContact(null);
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-destructive mb-4">Erro ao carregar contactos</p>
          <Button onClick={refetch}>Tentar Novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contactos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus contactos e comunicação
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importando..." : "Importar"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
          </Button>
          <Button variant="outline" asChild className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">
            <label className="cursor-pointer">
              <Camera className="h-4 w-4 mr-2" />
              Foto de Cartão
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCardImageUpload}
              />
            </label>
          </Button>
          <Button onClick={handleNewContact}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contacto
          </Button>
        </div>
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <div className="flex items-center gap-2 mb-2">
            <Cake className="h-5 w-5 text-pink-600" />
            <h3 className="font-semibold text-pink-900">Aniversários Próximos</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingBirthdays.map((contact) => (
              <span
                key={contact.id}
                className="px-3 py-1 bg-white rounded-full text-sm border border-pink-200"
              >
                {contact.name} -{" "}
                {new Date(contact.birth_date!).toLocaleDateString("pt-PT", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <ContactFilters searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      {/* Table */}
      <Card>
        <ContactsTable
          contacts={filteredContacts}
          loading={loading}
          onEdit={handleEditContact}
          onDelete={handleDeleteContact}
          onViewDetails={handleViewDetails}
          onConfigureAutoMessages={handleConfigureAutoMessagesClick}
          onTaskClick={(contact) => {
            // TODO: Implement quick task creation
            toast({ title: "Funcionalidade em desenvolvimento" });
          }}
          onEventClick={(contact) => {
            // TODO: Implement quick event creation
            toast({ title: "Funcionalidade em desenvolvimento" });
          }}
          onInteractionClick={(contact) => {
            setSelectedContact(contact);
            setInteractionForm({
              type: "call",
              subject: "",
              content: "",
              outcome: "",
              interaction_date: "",
            });
            setInteractionDialogOpen(true);
          }}
        />
      </Card>

      {/* Dialogs */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-purple-600" />
              Contacto Extraído do Cartão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {cardImage && (
              <div className="border rounded-lg overflow-hidden bg-gray-50 mb-4">
                <img 
                  src={cardImage} 
                  alt="Cartão de visita" 
                  className="w-full h-auto max-h-[200px] object-contain"
                />
              </div>
            )}
            
            {extracting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <span className="ml-3 text-muted-foreground">A analisar cartão...</span>
              </div>
            ) : extractedContact ? (
              <>
                <p className="text-sm text-muted-foreground bg-purple-50 p-3 rounded border border-purple-200">
                  ℹ️ Reveja os dados extraídos e corrija se necessário antes de guardar.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={extractedContact.name}
                      onChange={(e) => setExtractedContact({ ...extractedContact, name: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={extractedContact.email}
                      onChange={(e) => setExtractedContact({ ...extractedContact, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={extractedContact.phone}
                      onChange={(e) => setExtractedContact({ ...extractedContact, phone: e.target.value })}
                      placeholder="+351 ..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input
                      value={extractedContact.company || ""}
                      onChange={(e) => setExtractedContact({ ...extractedContact, company: e.target.value })}
                      placeholder="Nome da empresa"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={extractedContact.notes}
                    onChange={(e) => setExtractedContact({ ...extractedContact, notes: e.target.value })}
                    placeholder="Informações adicionais..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCardDialog(false);
                      setCardImage(null);
                      setExtractedContact(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveExtractedContact}
                    disabled={!extractedContact.name}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Guardar Contacto
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ContactDialogs
        dialogOpen={dialogOpen}
        onDialogOpenChange={setDialogOpen}
        editingContact={editingContact}
        formData={formData}
        onFormDataChange={setFormData}
        onFormSubmit={handleFormSubmit}
        autoMessageDialogOpen={autoMessageDialogOpen}
        onAutoMessageDialogOpenChange={setAutoMessageDialogOpen}
        autoMessageConfig={autoMessageConfig}
        onAutoMessageConfigChange={setAutoMessageConfig}
        onSaveAutoMessages={handleSaveAutoMessages}
        interactionDialogOpen={interactionDialogOpen}
        onInteractionDialogOpenChange={setInteractionDialogOpen}
        selectedContact={selectedContact}
        interactionForm={interactionForm}
        onInteractionFormChange={setInteractionForm}
        onCreateInteraction={handleCreateInteraction}
        creatingInteraction={submitting}
        detailsDialogOpen={detailsDialogOpen}
        onDetailsDialogOpenChange={setDetailsDialogOpen}
        contactInteractions={contactInteractions}
        loadingInteractions={loadingInteractions}
        onNewInteractionClick={handleNewInteractionClick}
      />
    </div>
  );
}