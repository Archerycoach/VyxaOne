import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Calendar, 
  Users, 
  TrendingUp, 
  MessageSquare, 
  FileText,
  BarChart3,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { frontendSettingsService } from "@/services/frontendSettingsService";

export default function LandingPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    app_name: "Vyxa One",
    app_tagline: "Plataforma completa de CRM para profissionais imobiliários",
    hero_title: "Gestão Inteligente de Leads Imobiliários",
    hero_subtitle: "Organize, acompanhe e converta mais leads com a plataforma CRM feita especialmente para agentes imobiliários",
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const publicSettings = await frontendSettingsService.getPublicSettings();
        setSettings((prev) => ({ ...prev, ...publicSettings }));
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  const features = [
    {
      icon: Users,
      title: "Gestão de Leads",
      description: "Centralize todos os seus contactos e leads numa plataforma única e intuitiva"
    },
    {
      icon: Calendar,
      title: "Agenda Integrada",
      description: "Sincronize com Google Calendar e nunca perca um compromisso importante"
    },
    {
      icon: Building2,
      title: "Gestão de Propriedades",
      description: "Organize o seu portfólio de imóveis com fotos, detalhes e matching automático"
    },
    {
      icon: MessageSquare,
      title: "Comunicação Multicanal",
      description: "WhatsApp, email e SMS integrados para comunicar eficientemente"
    },
    {
      icon: BarChart3,
      title: "Relatórios e Analytics",
      description: "Dashboards completos para acompanhar a performance da sua equipa"
    },
    {
      icon: TrendingUp,
      title: "Pipeline de Vendas",
      description: "Visualize e gerencie todo o processo de vendas em tempo real"
    }
  ];

  const benefits = [
    "Aumente a produtividade em até 40%",
    "Reduza o tempo de resposta aos leads",
    "Melhore a taxa de conversão",
    "Centralize toda a informação",
    "Automatize tarefas repetitivas",
    "Integração com ferramentas existentes"
  ];

  return (
    <>
      <Head>
        <title>{settings.app_name} - CRM para Imobiliárias</title>
        <meta 
          name="description" 
          content={settings.app_tagline}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Navigation */}
        <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <Image
                  src="/vyxa-logo-trasnparent.png"
                  alt={`${settings.app_name} Logo`}
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                  priority
                />
              </div>
              
              <div className="hidden md:flex items-center space-x-8">
                <Link href="/features" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
                  Funcionalidades
                </Link>
                <Link href="/pricing" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
                  Preços
                </Link>
                <Link href="/use-cases" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
                  Casos de Uso
                </Link>
                <Link href="/about" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
                  Sobre Nós
                </Link>
                <Link href="/contact" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
                  Contacto
                </Link>
              </div>

              <Link href="/login">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg">
                  Iniciar Sessão
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-tight">
                  {settings.hero_title}
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed">
                  {settings.hero_subtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/login">
                    <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-lg px-8 py-6 shadow-xl">
                      Começar Agora
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/features">
                    <Button size="lg" variant="outline" className="border-2 border-slate-300 hover:border-blue-600 hover:text-blue-600 font-semibold text-lg px-8 py-6">
                      Ver Funcionalidades
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-blue-100 to-green-100 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="absolute inset-0 bg-white/40 backdrop-blur-sm rounded-3xl flex items-center justify-center p-12">
                    <Image
                      src="/vyxa-logo-trasnparent.png"
                      alt="Vyxa One CRM Logo"
                      width={300}
                      height={300}
                      className="w-full h-auto object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Tudo o que precisa num só lugar
              </h2>
              <p className="text-xl text-slate-600">
                Ferramentas poderosas para impulsionar o seu negócio imobiliário
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-slate-50 rounded-2xl p-8 hover:shadow-xl transition-shadow border border-slate-200 group hover:border-blue-300"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 w-fit mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-gradient-to-br from-blue-50 to-green-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-slate-900 mb-6">
                  Por que escolher o {settings.app_name}?
                </h2>
                <p className="text-xl text-slate-600 mb-8">
                  Junte-se a centenas de profissionais imobiliários que já transformaram o seu negócio
                </p>
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700 text-lg">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white rounded-3xl shadow-2xl p-12 border border-slate-200">
                <div className="text-center space-y-6">
                  <TrendingUp className="h-20 w-20 text-blue-600 mx-auto" />
                  <h3 className="text-3xl font-bold text-slate-900">
                    Resultados Comprovados
                  </h3>
                  <div className="grid grid-cols-3 gap-6 pt-6">
                    <div>
                      <div className="text-4xl font-bold text-blue-600">40%</div>
                      <div className="text-sm text-slate-600 mt-2">Mais produtividade</div>
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-green-600">3x</div>
                      <div className="text-sm text-slate-600 mt-2">Conversão de leads</div>
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-purple-600">50%</div>
                      <div className="text-sm text-slate-600 mt-2">Menos tempo</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Pronto para transformar o seu negócio?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Comece a usar o {settings.app_name} hoje e veja os resultados
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold text-lg px-12 py-6 shadow-xl">
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-300 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-white font-bold text-lg mb-4">Produto</h3>
                <ul className="space-y-2">
                  <li><Link href="/features" className="hover:text-white transition-colors">Funcionalidades</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition-colors">Preços</Link></li>
                  <li><Link href="/use-cases" className="hover:text-white transition-colors">Casos de Uso</Link></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-bold text-lg mb-4">Empresa</h3>
                <ul className="space-y-2">
                  <li><Link href="/about" className="hover:text-white transition-colors">Sobre Nós</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contacto</Link></li>
                  <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Política de Privacidade</Link></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-bold text-lg mb-4">Suporte</h3>
                <ul className="space-y-2">
                  <li><Link href="/documentation" className="hover:text-white transition-colors">Documentação</Link></li>
                  <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                  <li><Link href="/support" className="hover:text-white transition-colors">Suporte Técnico</Link></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-bold text-lg mb-4">{settings.app_name}</h3>
                <p className="text-sm leading-relaxed mb-4">
                  {settings.app_tagline}
                </p>
              </div>
            </div>
            
            <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm">
              <p>&copy; 2026 {settings.app_name}. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}