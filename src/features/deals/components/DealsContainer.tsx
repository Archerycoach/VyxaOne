import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDeals } from "../hooks/useDeals";
import { Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Deal {
  id: string;
  user_id: string;
  lead_id: string | null;
  deal_type: "seller" | "buyer" | "both";
  transaction_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export function DealsContainer() {
  const { deals, loading, addDeal, updateDeal, deleteDeal, refetch } = useDeals();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState({
    deal_type: "seller" as "seller" | "buyer" | "both",
    transaction_date: new Date().toISOString().split("T")[0],
    amount: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingDeal) {
        await updateDeal(editingDeal.id, {
          deal_type: formData.deal_type,
          transaction_date: formData.transaction_date,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null,
        });
        toast({
          title: "Sucesso",
          description: "Negócio atualizado com sucesso",
        });
      } else {
        await addDeal({
          deal_type: formData.deal_type,
          transaction_date: formData.transaction_date,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null,
        });
        toast({
          title: "Sucesso",
          description: "Negócio registado com sucesso",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao guardar negócio",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      deal_type: deal.deal_type,
      transaction_date: deal.transaction_date,
      amount: deal.amount.toString(),
      notes: deal.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja eliminar este negócio?")) return;

    try {
      await deleteDeal(id);
      toast({
        title: "Sucesso",
        description: "Negócio eliminado com sucesso",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao eliminar negócio",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingDeal(null);
    setFormData({
      deal_type: "seller",
      transaction_date: new Date().toISOString().split("T")[0],
      amount: "",
      notes: "",
    });
  };

  const getDealTypeBadge = (type: string) => {
    const badges = {
      seller: <Badge variant="outline" className="bg-blue-50">Vendedor</Badge>,
      buyer: <Badge variant="outline" className="bg-green-50">Comprador</Badge>,
      both: <Badge variant="outline" className="bg-purple-50">Ambos</Badge>,
    };
    return badges[type as keyof typeof badges];
  };

  const totalAmount = deals.reduce((sum, deal) => sum + parseFloat(deal.amount.toString()), 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Negócios Realizados</h1>
          <p className="text-muted-foreground mt-1">
            Registe e acompanhe as suas transações concluídas
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Negócio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDeal ? "Editar Negócio" : "Registar Novo Negócio"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="deal_type">Tipo de Negócio</Label>
                <Select
                  value={formData.deal_type}
                  onValueChange={(value: "seller" | "buyer" | "both") =>
                    setFormData({ ...formData, deal_type: value })
                  }
                >
                  <SelectTrigger id="deal_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">Lead de Vendedor</SelectItem>
                    <SelectItem value="buyer">Lead de Comprador</SelectItem>
                    <SelectItem value="both">Ambos (Vendedor e Comprador)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="transaction_date">Data da Transação</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) =>
                    setFormData({ ...formData, transaction_date: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Valor (€)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Adicione informações adicionais sobre o negócio..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingDeal ? "Atualizar" : "Registar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Card */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Faturação Total</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-PT", {
                style: "currency",
                currency: "EUR",
              }).format(totalAmount)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">Total de Negócios</p>
            <p className="text-2xl font-bold">{deals.length}</p>
          </div>
        </div>
      </Card>

      {/* Deals Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  A carregar...
                </TableCell>
              </TableRow>
            ) : deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum negócio registado ainda. Clique em "Novo Negócio" para começar.
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    {format(new Date(deal.transaction_date), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>{getDealTypeBadge(deal.deal_type)}</TableCell>
                  <TableCell className="font-semibold">
                    {new Intl.NumberFormat("pt-PT", {
                      style: "currency",
                      currency: "EUR",
                    }).format(parseFloat(deal.amount.toString()))}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {deal.notes || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(deal)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(deal.id)}
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
      </Card>
    </div>
  );
}