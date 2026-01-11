import { useState } from "react";
import { 
  FileText, 
  FolderOpen, 
  Upload, 
  Search,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Layout } from "@/components/Layout";

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  category: "contracts" | "deeds" | "id" | "other";
}

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const documents: Document[] = [
    {
      id: "1",
      name: "Contrato_Promessa_Compra_Venda.pdf",
      type: "PDF",
      size: "2.4 MB",
      date: "2024-03-15",
      category: "contracts"
    },
    {
      id: "2",
      name: "Escritura_Imovel_Lisboa.pdf",
      type: "PDF",
      size: "5.1 MB",
      date: "2024-03-10",
      category: "deeds"
    },
    {
      id: "3",
      name: "CC_Cliente_Joao_Silva.jpg",
      type: "JPG",
      size: "1.2 MB",
      date: "2024-03-12",
      category: "id"
    }
  ];

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedCategory === "all" || doc.category === selectedCategory)
  );

  return (
    <Layout>
      <div className="p-8 bg-slate-50 min-h-screen">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Documentos 📁</h1>
            <p className="text-gray-500 mt-2">Gestão de arquivos e contratos</p>
          </div>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Novo Documento
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Filter */}
          <div className="col-span-12 md:col-span-3">
            <Card>
              <CardContent className="p-4 space-y-2">
                <Button 
                  variant={selectedCategory === "all" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("all")}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Todos os Arquivos
                </Button>
                <Button 
                  variant={selectedCategory === "contracts" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("contracts")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Contratos
                </Button>
                <Button 
                  variant={selectedCategory === "deeds" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("deeds")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Escrituras
                </Button>
                <Button 
                  variant={selectedCategory === "id" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("id")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Documentos ID
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-9">
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Pesquisar documentos..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <File className="h-8 w-8 text-blue-600" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <h3 className="font-medium mt-4 truncate" title={doc.name}>
                      {doc.name}
                    </h3>
                    
                    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                      <span>{doc.size}</span>
                      <span>{doc.date}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}