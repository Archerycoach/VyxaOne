import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Users, TrendingUp } from "lucide-react";

export default function UseCasesPage() {
  const cases = [
    {
      icon: Users,
      title: "Agentes Individuais",
      description: "Organize os seus leads, propriedades e agenda num único lugar",
      benefits: [
        "Gestão simplificada de contactos",
        "Agenda sincronizada",
        "Follow-ups automáticos",
        "Análise de performance"
      ]
    },
    {
      icon: Building2,
      title: "Pequenas Agências",
      description: "Colaboração em equipa com visibilidade total das operações",
      benefits: [
        "Gestão de equipa",
        "Atribuição de leads",
        "Relatórios consolidados",
        "Comunicação centralizada"
      ]
    },
    {
      icon: TrendingUp,
      title: "Grandes Imobiliárias",
      description: "Escalabilidade e automação para operações complexas",
      benefits: [
        "Workflows personalizados",
        "Integrações avançadas",
        "Analytics empresariais",
        "Suporte dedicado"
      ]
    }
  ];

  return (
    <>
      <Head>
        <title>Casos de Uso - Vyxa One</title>
        <meta name="description" content="Como o Vyxa One ajuda diferentes tipos de negócios imobiliários" />
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
              Casos de Uso
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Descubra como o Vyxa One se adapta ao seu modelo de negócio
            </p>
          </div>

          <div className="space-y-12">
            {cases.map((useCase, index) => (
              <div key={index} className="bg-white rounded-2xl p-12 shadow-lg border border-slate-200">
                <div className="flex items-start gap-6">
                  <div className="bg-blue-100 rounded-xl p-4">
                    <useCase.icon className="h-12 w-12 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                      {useCase.title}
                    </h2>
                    <p className="text-xl text-slate-600 mb-6">
                      {useCase.description}
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {useCase.benefits.map((benefit, benefitIndex) => (
                        <div key={benefitIndex} className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-blue-600 rounded-full" />
                          <span className="text-slate-700">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link href="/login">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Começar Agora
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}