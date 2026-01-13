import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { GripVertical, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getLeadColumnsConfig,
  updateLeadColumnConfig,
  updateLeadColumnsOrder,
  type LeadColumnConfig,
} from "@/services/leadColumnsService";

export function LeadColumnsSettings() {
  const [columns, setColumns] = useState<LeadColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadColumns();
  }, []);

  const loadColumns = async () => {
    try {
      setLoading(true);
      const data = await getLeadColumnsConfig();
      setColumns(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar colunas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (columnKey: string, isVisible: boolean) => {
    try {
      await updateLeadColumnConfig(columnKey, { is_visible: isVisible });
      setColumns((prev) =>
        prev.map((col) =>
          col.column_key === columnKey ? { ...col, is_visible: isVisible } : col
        )
      );
      toast({
        title: "Coluna atualizada",
        description: `Coluna ${isVisible ? "ativada" : "desativada"} com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar coluna",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleWidthChange = (columnKey: string, width: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.column_key === columnKey ? { ...col, column_width: width } : col
      )
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedItem);

    setColumns(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      const columnsOrder = columns.map((col, index) => ({
        column_key: col.column_key,
        column_order: index + 1,
      }));
      await updateLeadColumnsOrder(columnsOrder);

      // Save widths
      for (const col of columns) {
        await updateLeadColumnConfig(col.column_key, {
          column_width: col.column_width,
        });
      }

      toast({
        title: "Configurações guardadas",
        description: "A ordem e largura das colunas foram atualizadas",
      });
    } catch (error) {
      toast({
        title: "Erro ao guardar configurações",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Configuração de Colunas da Lista de Leads</h2>
          <p className="text-sm text-gray-500 mt-1">
            Personalize as colunas visíveis na visualização em lista
          </p>
        </div>
        <Button onClick={handleSaveOrder} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          Guardar Ordem
        </Button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 px-4 py-2">
          <div className="col-span-1"></div>
          <div className="col-span-4">Coluna</div>
          <div className="col-span-3">Largura</div>
          <div className="col-span-2">Visível</div>
        </div>

        {columns.map((column, index) => (
          <div
            key={column.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`grid grid-cols-12 gap-4 items-center p-4 bg-white border rounded-lg hover:shadow-md transition-shadow cursor-move ${
              draggedIndex === index ? "opacity-50" : ""
            }`}
          >
            <div className="col-span-1 flex items-center justify-center">
              <GripVertical className="h-5 w-5 text-gray-400" />
            </div>
            <div className="col-span-4">
              <span className="font-medium">{column.column_label}</span>
              <span className="text-xs text-gray-500 ml-2">({column.column_key})</span>
            </div>
            <div className="col-span-3">
              <Input
                type="text"
                value={column.column_width}
                onChange={(e) => handleWidthChange(column.column_key, e.target.value)}
                placeholder="ex: 150px, auto"
                className="h-8"
              />
            </div>
            <div className="col-span-2">
              <Switch
                checked={column.is_visible}
                onCheckedChange={(checked) =>
                  handleToggleVisibility(column.column_key, checked)
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">💡 Dicas</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Arraste as linhas para reorganizar a ordem das colunas</li>
          <li>• Use valores como "150px", "200px" ou "auto" para a largura</li>
          <li>• Desative colunas que não deseja ver na lista</li>
          <li>• Clique em "Guardar Ordem" para aplicar as alterações</li>
        </ul>
      </div>
    </Card>
  );
}