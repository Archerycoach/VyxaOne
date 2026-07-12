import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldAlert, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listVerifiedTotpFactors,
  enrollTotp,
  verifyTotpEnrollment,
  unenrollFactor,
  type TotpEnrollment,
} from "@/services/mfaService";

export function TwoFactorSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<{ id: string; friendlyName: string | null }[]>([]);

  // Fluxo de inscrição
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Desativação
  const [disableTarget, setDisableTarget] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const isEnabled = factors.length > 0;

  const load = async () => {
    setLoading(true);
    try {
      setFactors(await listVerifiedTotpFactors());
    } catch (err) {
      console.error("[TwoFactorSettings] Erro ao carregar fatores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStartEnroll = async () => {
    setEnrolling(true);
    try {
      const result = await enrollTotp();
      setEnrollment(result);
      setCode("");
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar 2FA",
        description: err.message || "Não foi possível iniciar a configuração.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (!enrollment) return;
    setVerifying(true);
    try {
      await verifyTotpEnrollment(enrollment.factorId, code);
      toast({ title: "2FA ativado com sucesso!", description: "A sua conta está agora protegida com autenticação de dois fatores." });
      setEnrollment(null);
      setCode("");
      await load();
    } catch (err: any) {
      toast({
        title: "Código inválido",
        description: err.message || "O código não está correto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleCancelEnroll = async () => {
    // Remove o fator ainda não verificado que ficou pendente.
    if (enrollment) {
      try {
        await unenrollFactor(enrollment.factorId);
      } catch {
        /* best-effort */
      }
    }
    setEnrollment(null);
    setCode("");
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await unenrollFactor(disableTarget);
      toast({ title: "2FA desativado" });
      setDisableTarget(null);
      await load();
    } catch (err: any) {
      toast({
        title: "Erro ao desativar",
        description: err.message || "Não foi possível desativar o 2FA.",
        variant: "destructive",
      });
    } finally {
      setDisabling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          Autenticação de dois fatores (2FA)
        </CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança: além da palavra-passe, é pedido um código de uma app
          autenticadora (Google Authenticator, Microsoft Authenticator, Authy…) ao iniciar sessão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar...
          </div>
        ) : enrollment ? (
          // Passo de inscrição: mostrar QR + verificar código
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              1. Abra a sua app autenticadora e leia este código QR (ou introduza a chave manualmente).
            </p>
            <div className="flex flex-col items-center gap-3 rounded-lg border p-4 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qrCode} alt="Código QR para 2FA" className="h-48 w-48" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono break-all">{enrollment.secret}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(enrollment.secret);
                    toast({ title: "Chave copiada" });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-code">2. Introduza o código de 6 dígitos gerado pela app</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="max-w-[160px] tracking-[0.3em] text-center text-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={verifying || code.length !== 6}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ativar 2FA
              </Button>
              <Button variant="outline" onClick={handleCancelEnroll} disabled={verifying}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : isEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600">Ativo</Badge>
              <span className="text-sm text-muted-foreground">
                A autenticação de dois fatores está ativada nesta conta.
              </span>
            </div>
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDisableTarget(factors[0].id)}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Desativar 2FA
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Inativo</Badge>
              <span className="text-sm text-muted-foreground">Ainda não configurou a autenticação de dois fatores.</span>
            </div>
            <Button onClick={handleStartEnroll} disabled={enrolling}>
              {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ativar 2FA
            </Button>
          </div>
        )}

        <AlertDialog open={disableTarget !== null} onOpenChange={(open) => !open && setDisableTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar 2FA?</AlertDialogTitle>
              <AlertDialogDescription>
                A sua conta deixará de pedir o código de segurança ao iniciar sessão. Recomendamos manter o 2FA ativo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disabling}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisable} disabled={disabling} className="bg-red-600 hover:bg-red-700">
                {disabling ? "A desativar..." : "Desativar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
