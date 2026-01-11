import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Mail, Phone, Book } from "lucide-react";

export default function SupportPage() {
  const supportOptions = [
    {
      icon: MessageCircle,
      title: "Chat ao Vivo",
      description: "Fale diretamente com a nossa equipa",
      action: "Iniciar Chat",
      available: "Seg-Sex, 9h-18h"
    },
    {
      icon: Mail,
      title: "Email",
      description: "Resposta em até 24 horas",
      action: "Enviar Email",
      link: "mailto:suporte@vyxa.pt"
    },
    {
      icon: Phone,
      title: "Telefone",
      description: "Suporte prioritário para clientes Enterprise",
      action: "Ligar Agora",
      link: "tel:+351123456789"
    },
    {
      icon: Book,
      title: "Documentação",
      description: "Guias e tutoriais completos",
      action: "Ver Documentação",
      link: "/documentation"
    }
  ];

  return (
    <>
      <Head>
        <title>Suporte Técnico - Vyxa One</title>
        <meta name="description" content="Obtenha ajuda e suporte técnico do Vyxa One" />
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
              Suporte Técnico
            </h1>
            <p className="text-xl text-slate-600">
              Estamos aqui para ajudar de várias formas
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {supportOptions.map((option, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-lg border border-slate-200"
              >
                <div className="bg-blue-100 rounded-lg p-4 w-fit mb-6">
                  <option.icon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  {option.title}
                </h3>
                <p className="text-slate-600 mb-4">
                  {option.description}
                </p>
                {option.available && (
                  <p className="text-sm text-slate-500 mb-4">
                    {option.available}
                  </p>
                )}
                {option.link ? (
                  <Link href={option.link}>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      {option.action}
                    </Button>
                  </Link>
                ) : (
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    {option.action}
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-white text-center">
            <h2 className="text-3xl font-bold mb-4">
              Suporte Premium
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Clientes Enterprise têm acesso a suporte 24/7, gestor de conta dedicado e onboarding personalizado
            </p>
            <Link href="/pricing">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                Ver Planos Enterprise
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}