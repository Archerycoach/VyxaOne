import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Política de Privacidade - Vyxa One CRM</title>
        <meta name="description" content="Política de privacidade do Vyxa One CRM" />
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

        {/* Content */}
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
              Política de Privacidade
            </h1>

            <div className="prose prose-lg max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Última atualização:</strong> {new Date().toLocaleDateString("pt-PT")}
              </p>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introdução</h2>
                <p className="text-gray-700 leading-relaxed">
                  A presente Política de Privacidade descreve como o Vyxa One CRM ("nós", "nosso" ou "Vyxa") recolhe, 
                  utiliza e protege as informações pessoais dos utilizadores ("você", "utilizador") da nossa plataforma de 
                  gestão imobiliária.
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Ao utilizar o Vyxa One CRM, você concorda com as práticas descritas nesta política. Se não concordar com 
                  qualquer parte desta política, por favor não utilize os nossos serviços.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Informações que Recolhemos</h2>
                
                <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.1 Informações de Conta</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Nome completo</li>
                  <li>Endereço de email</li>
                  <li>Número de telefone</li>
                  <li>Informações da empresa/agência</li>
                  <li>Palavra-passe (armazenada de forma encriptada)</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.2 Informações de Utilização</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Dados de leads e contactos geridos na plataforma</li>
                  <li>Informações de propriedades cadastradas</li>
                  <li>Registos de atividades e interações</li>
                  <li>Dados de calendário e agendamentos</li>
                  <li>Comunicações enviadas através da plataforma</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.3 Informações Técnicas</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Endereço IP</li>
                  <li>Tipo de navegador e dispositivo</li>
                  <li>Dados de cookies e tecnologias similares</li>
                  <li>Logs de acesso e utilização</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Como Utilizamos as Suas Informações</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Utilizamos as informações recolhidas para:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Fornecer e melhorar os nossos serviços</li>
                  <li>Gerir a sua conta e autenticação</li>
                  <li>Processar transações e pagamentos</li>
                  <li>Enviar notificações e atualizações importantes</li>
                  <li>Personalizar a sua experiência na plataforma</li>
                  <li>Analisar padrões de utilização para melhorias</li>
                  <li>Garantir a segurança e prevenir fraudes</li>
                  <li>Cumprir obrigações legais e regulamentares</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Partilha de Informações</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Não vendemos, alugamos ou partilhamos as suas informações pessoais com terceiros para fins de marketing. 
                  Podemos partilhar informações nas seguintes circunstâncias:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>
                    <strong>Fornecedores de Serviços:</strong> Partilhamos informações com prestadores de serviços que 
                    nos auxiliam na operação da plataforma (hospedagem, processamento de pagamentos, análises)
                  </li>
                  <li>
                    <strong>Integrações:</strong> Quando você conecta serviços de terceiros (Google Calendar, etc.), 
                    partilhamos apenas as informações necessárias para essas integrações
                  </li>
                  <li>
                    <strong>Requisitos Legais:</strong> Quando exigido por lei ou para proteger nossos direitos legais
                  </li>
                  <li>
                    <strong>Transferências Empresariais:</strong> Em caso de fusão, aquisição ou venda de ativos
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Segurança dos Dados</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Implementamos medidas de segurança técnicas e organizacionais para proteger as suas informações:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Encriptação de dados em trânsito (HTTPS/SSL)</li>
                  <li>Encriptação de palavras-passe</li>
                  <li>Controles de acesso baseados em funções</li>
                  <li>Monitorização de segurança e auditorias regulares</li>
                  <li>Backups regulares de dados</li>
                  <li>Proteção contra acesso não autorizado</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Os Seus Direitos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  De acordo com as leis de proteção de dados aplicáveis, você tem os seguintes direitos:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li><strong>Acesso:</strong> Solicitar cópia das suas informações pessoais</li>
                  <li><strong>Retificação:</strong> Corrigir informações imprecisas ou incompletas</li>
                  <li><strong>Eliminação:</strong> Solicitar a eliminação das suas informações</li>
                  <li><strong>Portabilidade:</strong> Receber suas informações em formato estruturado</li>
                  <li><strong>Oposição:</strong> Opor-se ao processamento das suas informações</li>
                  <li><strong>Restrição:</strong> Solicitar restrição do processamento</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Para exercer estes direitos, por favor contacte-nos através dos canais indicados na secção de contacto.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Retenção de Dados</h2>
                <p className="text-gray-700 leading-relaxed">
                  Mantemos as suas informações pessoais pelo tempo necessário para:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-4">
                  <li>Fornecer os nossos serviços</li>
                  <li>Cumprir obrigações legais e regulamentares</li>
                  <li>Resolver disputas e fazer cumprir acordos</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Quando encerrar a sua conta, eliminaremos ou anonimizaremos as suas informações pessoais, exceto 
                  quando a sua retenção for exigida por lei.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies e Tecnologias Similares</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Utilizamos cookies e tecnologias similares para:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Manter a sua sessão ativa</li>
                  <li>Memorizar as suas preferências</li>
                  <li>Analisar o uso da plataforma</li>
                  <li>Melhorar a funcionalidade e experiência do utilizador</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Você pode configurar o seu navegador para recusar cookies, mas isso pode afetar a funcionalidade 
                  de algumas partes da plataforma.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Alterações à Política de Privacidade</h2>
                <p className="text-gray-700 leading-relaxed">
                  Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações 
                  significativas através de email ou através de um aviso destacado na plataforma. A continuação 
                  do uso dos nossos serviços após tais alterações constitui aceitação da nova política.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contacto</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Se tiver questões, dúvidas ou solicitações relacionadas com esta Política de Privacidade ou com 
                  o tratamento das suas informações pessoais, por favor contacte-nos:
                </p>
                <div className="bg-gray-50 p-6 rounded-lg mt-4">
                  <p className="text-gray-700"><strong>Email:</strong> privacy@vyxa.pt</p>
                  <p className="text-gray-700 mt-2"><strong>Suporte:</strong> suporte@vyxa.pt</p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Conformidade Legal</h2>
                <p className="text-gray-700 leading-relaxed">
                  Esta Política de Privacidade está em conformidade com:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-4">
                  <li>Regulamento Geral de Proteção de Dados (RGPD)</li>
                  <li>Lei de Proteção de Dados Pessoais portuguesa</li>
                  <li>Outras leis e regulamentos aplicáveis de proteção de dados</li>
                </ul>
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