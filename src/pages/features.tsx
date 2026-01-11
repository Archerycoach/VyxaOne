import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function FeaturesPage() {
  const featureCategories = [
    {
      title: "Gestão de Leads",
      features: [
        "Captura automática de leads de múltiplas fontes",
        "Qualificação e pontuação de leads",
        "Atribuição automática a agentes",
        "Timeline completa de interações",
        "Notas e anexos ilimitados"
      ]
    },
    {
      title: "Agenda e Calendário",
      features: [
        "Sincronização bidirecional com Google Calendar",
        "Agendamento de visitas e reuniões",
        "Lembretes automáticos",
        "Visualização por dia/semana/mês",
        "Gestão de tarefas integrada"
      ]
    },
    {
      title: "Gestão de Propriedades",
      features: [
        "Catálogo completo de imóveis",
        "Upload de fotos e documentos",
        "Matching automático lead-propriedade",
        "Histórico de preços e alterações",
        "Integração com portais imobiliários"
      ]
    },
    {
      title: "Comunicação",
      features: [
        "WhatsApp Business integrado",
        "Templates de mensagens",
        "Email marketing automatizado",
        "SMS em massa",
        "Histórico completo de comunicações"
      ]
    },
    {
      title: "Relatórios e Analytics",
      features: [
        "Dashboards personalizáveis",
        "Métricas de performance",
        "Análise de pipeline de vendas",
        "Relatórios de equipa",
        "Exportação de dados"
      ]
    },
    {
      title: "Automação",
      features: [
        "Workflows personalizáveis",
        "Ações automáticas por etapa",
        "Follow-ups automáticos",
        "Tarefas recorrentes",
        "Notificações inteligentes"
      ]
    }
  ];

  return (
    <>
      <Head>
        <title>Funcionalidades - Vyxa One</title>
        <meta name="description" content="Conheça todas as funcionalidades do Vyxa One CRM" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/landing">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-slate-900 mb-4">
              Funcionalidades Completas
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Tudo o que precisa para gerir o seu negócio imobiliário de forma eficiente e profissional
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {featureCategories.map((category, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-lg border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  {category.title}
                </h2>
                <ul className="space-y-3">
                  {category.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link href="/login">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Experimentar Gratuitamente
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}