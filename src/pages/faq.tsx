import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQPage() {
  const faqs = [
    {
      question: "Como posso começar a usar o Vyxa One?",
      answer: "Basta criar uma conta gratuita e seguir o assistente de configuração inicial. Em menos de 5 minutos estará pronto para começar."
    },
    {
      question: "Posso importar os meus contactos existentes?",
      answer: "Sim! O Vyxa One permite importar contactos de ficheiros Excel, CSV ou diretamente de outras plataformas CRM."
    },
    {
      question: "O Vyxa One funciona no telemóvel?",
      answer: "Sim, o Vyxa One é totalmente responsivo e funciona perfeitamente em smartphones e tablets através do navegador."
    },
    {
      question: "Os meus dados estão seguros?",
      answer: "Absolutamente. Utilizamos encriptação de nível bancário e backups diários para garantir a segurança total dos seus dados."
    },
    {
      question: "Posso cancelar a qualquer momento?",
      answer: "Sim, pode cancelar a sua subscrição a qualquer momento sem custos adicionais ou períodos de fidelização."
    },
    {
      question: "Existe suporte em português?",
      answer: "Sim, todo o suporte é prestado em português por uma equipa dedicada que conhece o mercado imobiliário português."
    },
    {
      question: "Quantos utilizadores posso ter?",
      answer: "Depende do plano escolhido. O plano Starter permite 1 utilizador, o Professional até 5, e o Enterprise utilizadores ilimitados."
    },
    {
      question: "Existe período de teste gratuito?",
      answer: "Sim, oferecemos 14 dias de teste gratuito em todos os planos, sem necessidade de cartão de crédito."
    }
  ];

  return (
    <>
      <Head>
        <title>FAQ - Vyxa One</title>
        <meta name="description" content="Perguntas frequentes sobre o Vyxa One" />
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
              Perguntas Frequentes
            </h1>
            <p className="text-xl text-slate-600">
              Respostas às dúvidas mais comuns
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-12 text-center bg-blue-50 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Ainda tem dúvidas?
            </h2>
            <p className="text-slate-600 mb-6">
              A nossa equipa está pronta para ajudar
            </p>
            <Link href="/contact">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Contactar Suporte
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}