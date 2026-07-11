import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Termos de Serviço - Vyxa One CRM</title>
        <meta name="description" content="Termos de Serviço do Vyxa One CRM" />
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
              Termos de Serviço
            </h1>

            <div className="prose prose-lg max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Última atualização:</strong> {new Date().toLocaleDateString("pt-PT")}
              </p>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Aceitação dos Termos</h2>
                <p className="text-gray-700 leading-relaxed">
                  Ao aceder ou utilizar o Vyxa One CRM ("nós", "nosso" ou "Vyxa"), você ("utilizador", "você")
                  concorda em ficar vinculado a estes Termos de Serviço. Se não concordar com qualquer parte destes
                  termos, não deve utilizar a plataforma.
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Estes Termos aplicam-se em conjunto com a nossa{" "}
                  <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                    Política de Privacidade
                  </Link>
                  , que descreve como tratamos os seus dados pessoais.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Descrição do Serviço</h2>
                <p className="text-gray-700 leading-relaxed">
                  O Vyxa One é uma plataforma de gestão de relacionamento com clientes (CRM) desenhada para
                  profissionais e agências do setor imobiliário, que permite, entre outras funcionalidades: gerir
                  leads, contactos e imóveis; agendar tarefas e eventos; sincronizar com o Google Calendar; ligar
                  contas do Facebook/Instagram para captar leads de anúncios; enviar comunicações por email e
                  WhatsApp; e gerar conteúdo com apoio de inteligência artificial.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Contas e Registo</h2>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>É necessário criar uma conta para utilizar o Vyxa One, fornecendo informações verdadeiras e atualizadas.</li>
                  <li>É responsável por manter a confidencialidade das suas credenciais de acesso.</li>
                  <li>É responsável por toda a atividade que ocorra através da sua conta.</li>
                  <li>Cada agência/organização pode ter múltiplos utilizadores (consultores, team leads, brokers), com diferentes níveis de acesso definidos pelo administrador da conta.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Integrações com Terceiros</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  O Vyxa One permite ligar a sua conta a serviços de terceiros, como Google (Calendar, Contactos) e
                  Meta (Facebook/Instagram). Ao ligar estes serviços:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Autoriza o Vyxa One a aceder e sincronizar dados desses serviços, dentro do âmbito das permissões que concede.</li>
                  <li>Pode revogar este acesso em qualquer momento, através das configurações da própria conta Google/Meta ou dentro do Vyxa One.</li>
                  <li>O Vyxa One não é responsável pela disponibilidade, funcionamento ou políticas desses serviços de terceiros.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Subscrições e Pagamentos</h2>
                <p className="text-gray-700 leading-relaxed">
                  Algumas funcionalidades do Vyxa One requerem uma subscrição paga. Os preços, ciclos de faturação e
                  condições de cancelamento aplicáveis são apresentados na plataforma no momento da subscrição. O
                  não pagamento pode resultar na suspensão ou limitação do acesso à conta, sem prejuízo dos dados já
                  guardados serem mantidos durante um período razoável para permitir a exportação.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Utilização Aceitável</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Ao utilizar o Vyxa One, compromete-se a não:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>Utilizar a plataforma para fins ilegais ou não autorizados;</li>
                  <li>Enviar comunicações (email, WhatsApp, SMS) a pessoas sem base legal ou consentimento adequado para contacto;</li>
                  <li>Tentar aceder a contas ou dados de outros utilizadores sem autorização;</li>
                  <li>Interferir com o funcionamento normal da plataforma ou tentar contornar as suas medidas de segurança;</li>
                  <li>Utilizar dados de leads ou contactos de forma contrária à legislação de proteção de dados aplicável.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Propriedade dos Dados</h2>
                <p className="text-gray-700 leading-relaxed">
                  Os dados que introduz na plataforma (leads, contactos, notas, imóveis, etc.) pertencem a si e/ou à
                  sua agência. O Vyxa One atua como responsável pelo processamento técnico desses dados, nos termos
                  descritos na Política de Privacidade, mas não reivindica propriedade sobre o seu conteúdo.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Limitação de Responsabilidade</h2>
                <p className="text-gray-700 leading-relaxed">
                  O Vyxa One é fornecido "tal como está", sem garantias de disponibilidade ininterrupta ou ausência
                  de erros. Na medida permitida por lei, não somos responsáveis por danos indiretos, perda de
                  negócio ou de dados resultantes da utilização ou impossibilidade de utilização da plataforma,
                  incluindo falhas em integrações de terceiros (Google, Meta, WhatsApp) fora do nosso controlo
                  direto.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Suspensão e Encerramento</h2>
                <p className="text-gray-700 leading-relaxed">
                  Podemos suspender ou encerrar o acesso à sua conta em caso de violação destes Termos, uso indevido
                  da plataforma, ou não pagamento de valores devidos. Pode encerrar a sua conta em qualquer momento,
                  contactando o suporte.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Alterações aos Termos</h2>
                <p className="text-gray-700 leading-relaxed">
                  Podemos atualizar estes Termos periodicamente. Notificaremos sobre alterações significativas
                  através de email ou de um aviso destacado na plataforma. A continuação do uso dos nossos serviços
                  após tais alterações constitui aceitação dos novos Termos.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Lei Aplicável</h2>
                <p className="text-gray-700 leading-relaxed">
                  Estes Termos são regidos pela lei portuguesa. Quaisquer litígios decorrentes destes Termos serão
                  submetidos aos tribunais competentes de Portugal.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contacto</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Para questões relacionadas com estes Termos de Serviço, contacte-nos:
                </p>
                <div className="bg-gray-50 p-6 rounded-lg mt-4">
                  <p className="text-gray-700"><strong>Email:</strong> suporte@vyxa.pt</p>
                </div>
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
