import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Image from "next/image";
import { frontendSettingsService } from "@/services/frontendSettingsService";
import { PRIVACY_POLICY_URL } from "@/lib/legalLinks";

/**
 * Informação legal obrigatória para venda online em Portugal — identificação
 * do vendedor, condições de prestação do serviço, RAL/arbitragem, direito de
 * livre resolução (art. 10.º do DL 24/2014) e Livro de Reclamações.
 *
 * Os dados de identificação vêm de frontend_settings (Admin › Configurações
 * do Frontend), porque cada instância pode pertencer a uma entidade diferente.
 */
export default function InformacaoLegal() {
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    frontendSettingsService.getPublicSettings().then(setSettings).catch(() => {});
  }, []);

  const appName = settings.app_name || "Vyxa One";

  return (
    <>
      <Head>
        <title>{settings.seo_title_informacao_legal || `Informação Legal - ${appName}`}</title>
        <meta
          name="description"
          content={settings.seo_description_informacao_legal || `Informação legal, identificação do vendedor, resolução de litígios e Livro de Reclamações do ${appName}.`}
        />
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
              {settings.heading_informacao_legal || "Informação Legal"}
            </h1>

            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Identificação do Vendedor</h2>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="text-gray-700"><strong>Denominação:</strong> {settings.legal_company_name || appName}</p>
                  <p className="text-gray-700"><strong>NIF:</strong> {settings.legal_nif || "—"}</p>
                  <p className="text-gray-700"><strong>Morada:</strong> {settings.company_address || "—"}</p>
                  <p className="text-gray-700"><strong>Telefone:</strong> {settings.contact_phone || "—"}</p>
                  <p className="text-gray-700"><strong>Email:</strong> {settings.contact_email || "suporte@vyxa.pt"}</p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Termos e Condições</h2>
                <p className="text-gray-700 leading-relaxed">
                  As condições de utilização e contratação do serviço estão disponíveis nos{" "}
                  <Link href="/terms-of-service" className="text-blue-600 hover:underline">
                    Termos de Serviço
                  </Link>
                  .
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Prazos e Condições de Prestação do Serviço</h2>
                <p className="text-gray-700 leading-relaxed">
                  O {appName} é um serviço digital (software como serviço), sem entrega de bens físicos. O acesso à
                  plataforma é disponibilizado <strong>imediatamente após a confirmação do pagamento</strong> da
                  subscrição — em regra, em poucos minutos — e mantém-se durante todo o período subscrito. Em caso
                  de dificuldade na ativação, contacte-nos pelos meios indicados na secção 1 e resolveremos no prazo
                  máximo de 2 dias úteis.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Resolução Alternativa de Litígios (RAL)</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Nos termos da Lei n.º 144/2015, de 8 de setembro, em caso de litígio de consumo, o consumidor pode
                  recorrer a uma entidade de Resolução Alternativa de Litígios de consumo:
                </p>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Entidade competente:</strong>{" "}
                    {settings.legal_arbitration_center || "CACCL — Centro de Arbitragem de Conflitos de Consumo de Lisboa — www.centroarbitragemlisboa.pt"}
                  </p>
                  <p className="text-gray-700 mt-2">
                    Lista atualizada de entidades RAL disponível no Portal do Consumidor:{" "}
                    <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      www.consumidor.gov.pt
                    </a>
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Direito de Livre Resolução</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Nos termos do artigo 10.º do Decreto-Lei n.º 24/2014, de 14 de fevereiro, o consumidor tem o
                  direito de resolver o contrato celebrado à distância, sem indicar qualquer motivo, no prazo de{" "}
                  <strong>14 dias</strong> a contar da celebração do contrato, mediante comunicação inequívoca
                  enviada para os contactos indicados na secção 1 (pode utilizar, para o efeito, o modelo de
                  declaração constante do anexo ao referido diploma).
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Se solicitar o início da prestação do serviço durante o prazo de livre resolução e o serviço for
                  integralmente prestado, o direito de livre resolução cessa após a execução completa do contrato,
                  com o seu consentimento prévio expresso (artigo 17.º do mesmo diploma). Havendo lugar a reembolso,
                  este é efetuado pelo mesmo meio de pagamento no prazo de 14 dias.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Livro de Reclamações</h2>
                <p className="text-gray-700 leading-relaxed">
                  Pode apresentar a sua reclamação através do Livro de Reclamações Eletrónico:
                </p>
                <div className="bg-gray-50 p-6 rounded-lg mt-4">
                  <a
                    href="https://www.livroreclamacoes.pt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    www.livroreclamacoes.pt
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Política de Proteção de Dados</h2>
                <p className="text-gray-700 leading-relaxed">
                  O tratamento de dados pessoais é descrito na nossa{" "}
                  <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Política de Privacidade
                  </a>
                  .
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
