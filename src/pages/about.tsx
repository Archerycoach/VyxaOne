import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Heart, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Sobre Nós - Vyxa One</title>
        <meta name="description" content="Conheça a missão e valores da Vyxa" />
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

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-slate-900 mb-4">
              Sobre o Vyxa One
            </h1>
            <p className="text-xl text-slate-600">
              Transformando a forma como os profissionais imobiliários trabalham
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-slate-200 mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                A Nossa Missão
              </h2>
              <p className="text-slate-700 leading-relaxed">
                O Vyxa One nasceu da necessidade real de profissionais imobiliários que procuravam uma solução completa, 
                intuitiva e poderosa para gerir o seu negócio. Acreditamos que a tecnologia deve simplificar processos, 
                não complicá-los.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white rounded-xl p-8 shadow-lg border border-slate-200 text-center">
                <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
                  <Target className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Foco</h3>
                <p className="text-slate-600">
                  100% dedicados ao mercado imobiliário português
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-lg border border-slate-200 text-center">
                <div className="bg-green-100 rounded-full p-4 w-fit mx-auto mb-4">
                  <Heart className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Paixão</h3>
                <p className="text-slate-600">
                  Construímos ferramentas que adoramos usar
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-lg border border-slate-200 text-center">
                <div className="bg-purple-100 rounded-full p-4 w-fit mx-auto mb-4">
                  <Zap className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Inovação</h3>
                <p className="text-slate-600">
                  Sempre à frente com as melhores tecnologias
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-white text-center">
              <h2 className="text-3xl font-bold mb-4">
                Junte-se a Nós
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                Faça parte da transformação digital do setor imobiliário
              </p>
              <Link href="/login">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                  Começar Agora
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}