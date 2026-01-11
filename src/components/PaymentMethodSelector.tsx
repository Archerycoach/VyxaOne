import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Smartphone, Building2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

interface PaymentMethodSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  planId: string;
  planName: string;
  planPrice: number;
  onSuccess?: () => void;
}

type PaymentMethod = "stripe" | "mbway" | "multibanco" | null;

interface MultibancoReference {
  entity: string;
  reference: string;
  amount: string;
  expiryDate: string;
}

export function PaymentMethodSelector({
  isOpen,
  onClose,
  userId,
  planId,
  planName,
  planPrice,
  onSuccess,
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [multibancoRef, setMultibancoRef] = useState<MultibancoReference | null>(null);
  const [mbwaySuccess, setMbwaySuccess] = useState(false);

  // Format phone number for Portugal
  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.startsWith("351")) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("9")) {
      return `+351${cleaned}`;
    }
    return value;
  };

  // Handle Stripe payment
  const handleStripePayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar sessão de pagamento");
      }

      // Redirect to Stripe Checkout
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
      if (!stripe) {
        throw new Error("Erro ao carregar Stripe");
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MBWay payment
  const handleMBWayPayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!phone) {
        throw new Error("Por favor, insira o número de telemóvel");
      }

      const formattedPhone = formatPhone(phone);

      const response = await fetch("/api/eupago/create-mbway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId, phone: formattedPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar pagamento MBWay");
      }

      setMbwaySuccess(true);
      
      // Auto-close after 3 seconds and show success
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Multibanco payment
  const handleMultibancoPayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/eupago/create-multibanco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar referência Multibanco");
      }

      setMultibancoRef({
        entity: data.entity,
        reference: data.reference,
        amount: data.amount,
        expiryDate: data.expiryDate,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
    setMultibancoRef(null);
    setMbwaySuccess(false);
  };

  const handleBack = () => {
    setSelectedMethod(null);
    setError(null);
    setPhone("");
    setMultibancoRef(null);
    setMbwaySuccess(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Escolha o Método de Pagamento</DialogTitle>
          <DialogDescription>
            Subscrição: <strong>{planName}</strong> - €{planPrice.toFixed(2)}/mês
          </DialogDescription>
        </DialogHeader>

        {!selectedMethod && (
          <div className="grid gap-4 py-4">
            {/* Stripe - Cartão */}
            <Card 
              className="cursor-pointer hover:border-blue-500 transition-all hover:shadow-md"
              onClick={() => handleMethodSelect("stripe")}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Cartão de Crédito/Débito</h3>
                  <p className="text-sm text-muted-foreground">
                    Visa, Mastercard, Amex - Pagamento seguro via Stripe
                  </p>
                </div>
                <div className="flex gap-2">
                  <img src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" alt="Visa" className="h-8" />
                  <img src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" alt="Mastercard" className="h-8" />
                </div>
              </CardContent>
            </Card>

            {/* MBWay */}
            <Card 
              className="cursor-pointer hover:border-green-500 transition-all hover:shadow-md"
              onClick={() => handleMethodSelect("mbway")}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">MBWay</h3>
                  <p className="text-sm text-muted-foreground">
                    Pagamento instantâneo via telemóvel
                  </p>
                </div>
                <div className="text-2xl font-bold text-green-600">MB</div>
              </CardContent>
            </Card>

            {/* Multibanco */}
            <Card 
              className="cursor-pointer hover:border-orange-500 transition-all hover:shadow-md"
              onClick={() => handleMethodSelect("multibanco")}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <Building2 className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Multibanco</h3>
                  <p className="text-sm text-muted-foreground">
                    Referência para pagamento em ATM ou Homebanking
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stripe Payment */}
        {selectedMethod === "stripe" && !isLoading && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900">Pagamento Seguro via Stripe</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Será redirecionado para o checkout seguro do Stripe. 
                    Seus dados de pagamento são protegidos com criptografia de nível bancário.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleStripePayment} className="flex-1">
                Continuar para Stripe
              </Button>
            </div>
          </div>
        )}

        {/* MBWay Payment */}
        {selectedMethod === "mbway" && !mbwaySuccess && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Telemóvel</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+351 912 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Insira o número associado à sua conta MBWay
              </p>
            </div>

            <div className="rounded-lg border bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900">Como Funciona</h4>
                  <ol className="text-sm text-green-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Insira o seu número de telemóvel</li>
                    <li>Receberá uma notificação no app MBWay</li>
                    <li>Confirme o pagamento com o seu PIN</li>
                    <li>Sua subscrição será ativada automaticamente</li>
                  </ol>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1" disabled={isLoading}>
                Voltar
              </Button>
              <Button onClick={handleMBWayPayment} className="flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Processando..." : "Pagar com MBWay"}
              </Button>
            </div>
          </div>
        )}

        {/* MBWay Success */}
        {mbwaySuccess && (
          <div className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Pagamento Enviado!</h3>
                <p className="text-muted-foreground mt-2">
                  Por favor, confirme o pagamento no seu telemóvel.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Receberá uma notificação MBWay em instantes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Multibanco Payment */}
        {selectedMethod === "multibanco" && !multibancoRef && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-orange-900">Referência Multibanco</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Será gerada uma referência única que pode pagar em qualquer ATM ou Homebanking.
                    A referência é válida por 7 dias.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1" disabled={isLoading}>
                Voltar
              </Button>
              <Button onClick={handleMultibancoPayment} className="flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Gerando..." : "Gerar Referência"}
              </Button>
            </div>
          </div>
        )}

        {/* Multibanco Reference Display */}
        {multibancoRef && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
              <h3 className="text-center font-semibold text-orange-900 mb-4">
                Referência Multibanco Gerada
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white rounded">
                  <span className="text-sm font-medium">Entidade:</span>
                  <button
                    onClick={() => copyToClipboard(multibancoRef.entity)}
                    className="text-lg font-bold hover:text-orange-600 transition-colors"
                  >
                    {multibancoRef.entity}
                  </button>
                </div>

                <div className="flex justify-between items-center p-3 bg-white rounded">
                  <span className="text-sm font-medium">Referência:</span>
                  <button
                    onClick={() => copyToClipboard(multibancoRef.reference)}
                    className="text-lg font-bold hover:text-orange-600 transition-colors"
                  >
                    {multibancoRef.reference}
                  </button>
                </div>

                <div className="flex justify-between items-center p-3 bg-white rounded">
                  <span className="text-sm font-medium">Montante:</span>
                  <span className="text-lg font-bold">€{multibancoRef.amount}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-white rounded">
                  <span className="text-sm font-medium">Válida até:</span>
                  <span className="text-sm font-medium">{multibancoRef.expiryDate}</span>
                </div>
              </div>

              <p className="text-xs text-center text-orange-700 mt-4">
                Clique nos valores para copiar. Pague em qualquer ATM ou Homebanking.
              </p>
            </div>

            <div className="rounded-lg border bg-blue-50 p-4">
              <h4 className="font-medium text-blue-900 mb-2">Como Pagar:</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Vá a um ATM Multibanco ou aceda ao seu Homebanking</li>
                <li>Selecione "Pagamentos" ou "Pagamento de Serviços"</li>
                <li>Insira a Entidade e Referência</li>
                <li>Confirme o montante e conclua o pagamento</li>
                <li>Sua subscrição será ativada automaticamente após confirmação</li>
              </ol>
            </div>

            <Button onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && selectedMethod === "stripe" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground mt-4">
              Redirecionando para checkout seguro...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}