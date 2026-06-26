import { useState } from "react";
import { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import SEO from "@/components/SEO";

interface UnsubscribePageProps {
  valid: boolean;
  leadName?: string;
  companyName?: string;
  token?: string;
}

export const getServerSideProps: GetServerSideProps<UnsubscribePageProps> = async (context) => {
  const { token } = context.params as { token: string };

  if (!token) {
    return { props: { valid: false } };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, user_id, email_opt_out")
    .eq("email_unsub_token", token)
    .maybeSingle();

  if (!lead) {
    return { props: { valid: false } };
  }

  // Fetch company name
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", lead.user_id)
    .maybeSingle();

  return {
    props: {
      valid: true,
      leadName: lead.name || "Cliente",
      companyName: profile?.company_name || "VYXA",
      token,
    },
  };
};

export default function UnsubscribePage({ valid, leadName, companyName, token }: UnsubscribePageProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleUnsubscribe = async () => {
    setStatus("processing");
    
    try {
      const response = await fetch("/api/unsubscribe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage("A sua subscrição foi cancelada com sucesso. Não receberá mais emails da nossa parte.");
      } else {
        setStatus("error");
        setMessage(data.error || "Ocorreu um erro ao processar o pedido.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Erro de conexão. Por favor, tente novamente mais tarde.");
    }
  };

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <SEO 
          title="Link Inválido - Cancelamento de Subscrição"
          description="O link de cancelamento de subscrição não é válido ou já expirou."
        />
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-6 w-6" />
              <CardTitle>Link Inválido</CardTitle>
            </div>
            <CardDescription>
              O link de cancelamento de subscrição não é válido ou já foi utilizado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <SEO 
          title="Subscrição Cancelada - Email"
          description="A sua subscrição de emails foi cancelada com sucesso."
        />
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Subscrição Cancelada</CardTitle>
            </div>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Se mudou de ideias, pode sempre voltar a subscrever contactando diretamente {companyName}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <SEO 
        title="Cancelar Subscrição de Email"
        description="Cancele a sua subscrição de emails de forma rápida e segura."
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cancelar Subscrição de Email</CardTitle>
          <CardDescription>
            {leadName}, tem a certeza que pretende cancelar a subscrição de emails de {companyName}?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Ao confirmar, deixará de receber emails automáticos sobre oportunidades imobiliárias e atualizações da nossa parte.
          </p>
          <p className="text-sm text-gray-600 font-medium">
            Esta ação não afeta a sua subscrição de mensagens WhatsApp (caso tenha dado consentimento separadamente).
          </p>
          
          {status === "error" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {message}
            </div>
          )}

          <Button 
            onClick={handleUnsubscribe} 
            disabled={status === "processing"}
            variant="destructive"
            className="w-full"
          >
            {status === "processing" ? "A processar..." : "Confirmar Cancelamento"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}