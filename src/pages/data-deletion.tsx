import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { frontendSettingsService } from "@/services/frontendSettingsService";

export default function DataDeletion() {
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    frontendSettingsService.getPublicSettings().then(setSettings).catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <title>{settings.seo_title_data_deletion || "Eliminação de Dados - Vyxa One CRM"}</title>
        <meta name="description" content={settings.seo_description_data_deletion || "Como solicitar a eliminação dos seus dados no Vyxa One CRM"} />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="container mx-auto flex items-center justify-between">
            <Image
              src="/vyxa-logo.png"
              alt="Vyxa Logo"
              width={150}
              height={40}
              className="h-8 w-auto mb-6"
            />
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
              {settings.heading_data_deletion || "Eliminação de Dados"}
            </h1>

            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                Se ligou a sua conta do Facebook ao Vyxa One CRM (para trazer leads dos seus anúncios do Facebook/Instagram)
                e quer que os dados recolhidos através dessa ligação sejam eliminados, tem duas formas de o fazer.
              </p>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Desligar o acesso a partir do Facebook</h2>
                <p className="text-gray-700 leading-relaxed">
                  Pode revogar o acesso do Vyxa One CRM à sua conta do Facebook em qualquer momento, em{" "}
                  <a
                    href="https://www.facebook.com/settings?tab=business_tools"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Configurações do Facebook → Aplicações e Sites
                  </a>
                  . Ao remover o Vyxa One CRM dessa lista, deixamos de ter acesso às suas Páginas e formulários de anúncios.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Pedir a eliminação dos dados já guardados</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Para pedir a eliminação de todos os dados que o Vyxa One CRM guardou a partir da sua conta do
                  Facebook (leads recolhidas via formulários de anúncios, tokens de acesso às suas Páginas, e o
                  histórico de sincronização associado), envie um email para:
                </p>
                <div className="bg-gray-50 p-6 rounded-lg mt-4">
                  <p className="text-gray-700"><strong>Email:</strong> {settings.privacy_email || "privacy@vyxa.pt"}</p>
                  <p className="text-gray-700 mt-2"><strong>Assunto sugerido:</strong> Pedido de eliminação de dados (Facebook)</p>
                </div>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Inclua o email associado à sua conta Vyxa One e, se souber, o nome da(s) Página(s) do Facebook que
                  tinha ligado. Confirmamos e concluímos o pedido no prazo máximo de 30 dias.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">O que é eliminado</h2>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>O token de acesso guardado para as suas Páginas do Facebook</li>
                  <li>O registo da ligação entre a sua conta e as Páginas (Definições → Meta)</li>
                  <li>O histórico de sincronização de formulários associado a essa ligação</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Leads que já foram importadas para o seu CRM antes do pedido continuam a ser tratadas como dados de
                  clientes seus, geridos de acordo com a nossa{" "}
                  <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                    Política de Privacidade
                  </Link>{" "}
                  — se também quiser eliminar leads específicas, indique isso no mesmo email.
                </p>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t">
              <Link href="/landing">
                <Button className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar à Página Inicial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
