import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Video, FileText } from "lucide-react";

export default function DocumentationPage() {
  const sections = [
    {
      icon: BookOpen,
      title: "Guia de Início Rápido",
      description: "Comece a usar o Vyxa One em minutos",
      link: "#quickstart"
    },
    {
      icon: Video,
      title: "Tutoriais em Vídeo",
      description: "Aprenda visualmente com os nossos tutoriais",
      link: "#videos"
    },
    {
      icon: FileText,
      title: "Manual Completo",
      description: "Documentação detalhada de todas as funcionalidades",
      link: "#manual"
    }
  ];

  return (
    <>
      <Head>
        <title>Documentação - Vyxa One</title>
        <meta name="description" content="Documentação e tutoriais do Vyxa One" />
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
              Documentação
            </h1>
            <p className="text-xl text-slate-600">
              Tudo o que precisa de saber sobre o Vyxa One
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {sections.map((section, index) => (
              <a
                key={index}
                href={section.link}
                className="bg-white rounded-xl p-8 shadow-lg border border-slate-200 hover:border-blue-600 transition-colors group"
              >
                <div className="bg-blue-100 rounded-lg p-4 w-fit mb-4 group-hover:bg-blue-600 transition-colors">
                  <section.icon className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {section.title}
                </h3>
                <p className="text-slate-600">
                  {section.description}
                </p>
              </a>
            ))}
          </div>

          <div className="bg-white rounded-xl p-12 shadow-lg border border-slate-200">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Tópicos Populares
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                "Como criar e gerir leads",
                "Sincronizar com Google Calendar",
                "Configurar automações",
                "Gerir propriedades",
                "Relatórios e analytics",
                "Gestão de equipa"
              ].map((topic, index) => (
                <div key={index} className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <div className="h-2 w-2 bg-blue-600 rounded-full" />
                  <span className="text-slate-700">{topic}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}