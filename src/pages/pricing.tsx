import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function PricingPage() {
  const plans = [
    {
      name: "Starter",
      price: "29€",
      period: "/mês",
      description: "Perfeito para agentes individuais",
      features: [
        "Até 100 leads",
        "1 utilizador",
        "Gestão de propriedades",
        "Agenda integrada",
        "Suporte por email"
      ]
    },
    {
      name: "Professional",
      price: "79€",
      period: "/mês",
      description: "Ideal para pequenas equipas",
      features: [
        "Leads ilimitados",
        "Até 5 utilizadores",
        "Todas as funcionalidades Starter",
        "WhatsApp integrado",
        "Relatórios avançados",
        "Suporte prioritário"
      ],
      featured: true
    },
    {
      name: "Enterprise",
      price: "Personalizado",
      period: "",
      description: "Para grandes equipas e empresas",
      features: [
        "Tudo do Professional",
        "Utilizadores ilimitados",
        "API personalizada",
        "Onboarding dedicado",
        "Suporte 24/7",
        "Gestor de conta dedicado"
      ]
    }
  ];

  return (
    <>
      <Head>
        <title>Preços - Vyxa One</title>
        <meta name="description" content="Planos e preços do Vyxa One CRM" />
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
              Planos e Preços
            </h1>
            <p className="text-xl text-slate-600">
              Escolha o plano ideal para o seu negócio
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl p-8 ${
                  plan.featured
                    ? "ring-2 ring-blue-600 shadow-2xl scale-105"
                    : "shadow-lg border border-slate-200"
                }`}
              >
                {plan.featured && (
                  <div className="bg-blue-600 text-white text-sm font-semibold px-4 py-1 rounded-full w-fit mb-4">
                    Mais Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-slate-600 mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-slate-900">
                    {plan.price}
                  </span>
                  <span className="text-slate-600">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login">
                  <Button
                    className={`w-full ${
                      plan.featured
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-slate-900 hover:bg-slate-800"
                    }`}
                  >
                    Começar Agora
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}