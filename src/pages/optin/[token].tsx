import { useState } from "react";
import { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface OptInPageProps {
  valid: boolean;
  companyName?: string;
  token?: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.params?.token as string;
  
  if (!token) {
    return { props: { valid: false } };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch lead and get company name from user settings
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("user_id, follow_up_state")
    .eq("consent_token", token)
    .single();

  if (!lead) {
    return { props: { valid: false } };
  }

  const { data: appSettings } = await supabaseAdmin
    .from("app_settings")
    .select("company_name")
    .eq("user_id", lead.user_id)
    .maybeSingle();

  // Fallback if settings don't exist
  let companyName = appSettings?.company_name || "a nossa agência";
  
  // Se não existir, tenta encontrar o nome da equipa ou utilizador
  if (!appSettings?.company_name) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", lead.user_id)
      .single();
    if (user?.full_name) companyName = user.full_name;
  }

  return {
    props: {
      valid: true,
      companyName,
      token
    }
  };
};

export default function OptInPage({ valid, companyName, token }: OptInPageProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const consentText = `Aceito receber mensagens da ${companyName} no WhatsApp sobre a minha procura imobiliária e oportunidades semelhantes.`;

  const handleSubmit = async () => {
    if (!accepted) return;
    
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/optin/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consentText })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Ocorreu um erro ao processar o seu pedido.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-0 text-center">
          <CardHeader>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-slate-800">Link Inválido ou Expirado</CardTitle>
            <CardDescription className="text-base mt-2">
              Este link de confirmação já não se encontra disponível ou já foi utilizado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-0 text-center">
          <CardHeader>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-slate-800">Obrigado!</CardTitle>
            <CardDescription className="text-base mt-2">
              O seu consentimento foi registado com sucesso. A partir de agora, enviaremos as melhores oportunidades diretamente para o seu WhatsApp.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-800">Comunicação via WhatsApp</CardTitle>
          <CardDescription className="text-base mt-2 text-slate-600 leading-relaxed">
            Para sua conveniência e de forma mais ágil, gostaríamos de continuar a comunicar consigo sobre imóveis através do WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 text-blue-800 p-4 rounded-md text-sm mb-6">
            Em conformidade com o Regulamento Geral de Proteção de Dados (RGPD), precisamos do seu consentimento explícito.
          </div>
          
          <div className="flex items-start space-x-3 mb-4">
            <Checkbox 
              id="consent" 
              checked={accepted} 
              onCheckedChange={(checked) => setAccepted(checked === true)}
              className="mt-1"
            />
            <label 
              htmlFor="consent" 
              className="text-sm font-medium leading-relaxed cursor-pointer select-none text-slate-700"
            >
              {consentText}
            </label>
          </div>
          
          {error && (
            <p className="text-sm text-red-500 font-medium mt-2">{error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full text-base font-semibold py-6" 
            onClick={handleSubmit} 
            disabled={!accepted || loading}
          >
            {loading ? "A processar..." : "Confirmar Consentimento"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}