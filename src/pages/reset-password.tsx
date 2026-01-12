import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  useEffect(() => {
    // Verificar se temos um token de recuperação válido na URL
    const checkRecoveryToken = async () => {
      try {
        // Obter o hash da URL (contém o token)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");

        if (!accessToken || type !== "recovery") {
          setError("Link de recuperação inválido ou expirado.");
          setIsCheckingToken(false);
          return;
        }

        // Verificar a sessão com o token
        const { data, error } = await supabase.auth.getSession();
        
        if (error || !data.session) {
          setError("Link de recuperação inválido ou expirado.");
          setIsCheckingToken(false);
          return;
        }

        // Token válido
        setIsValidToken(true);
        setIsCheckingToken(false);
      } catch (err: any) {
        console.error("Erro ao verificar token:", err);
        setError("Erro ao verificar link de recuperação.");
        setIsCheckingToken(false);
      }
    };

    checkRecoveryToken();
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return "A password deve ter pelo menos 8 caracteres.";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "A password deve conter pelo menos uma letra maiúscula.";
    }
    if (!/[a-z]/.test(pwd)) {
      return "A password deve conter pelo menos uma letra minúscula.";
    }
    if (!/[0-9]/.test(pwd)) {
      return "A password deve conter pelo menos um número.";
    }
    if (!/[!@#$%^&*]/.test(pwd)) {
      return "A password deve conter pelo menos um caractere especial (!@#$%^&*).";
    }
    return null;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validar password
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        setIsLoading(false);
        return;
      }

      // Verificar se as passwords coincidem
      if (password !== confirmPassword) {
        setError("As passwords não coincidem.");
        setIsLoading(false);
        return;
      }

      // Atualizar a password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setIsSuccess(true);

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      console.error("Erro ao redefinir password:", err);
      setError(err.message || "Ocorreu um erro ao redefinir a password.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-6 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">A verificar link de recuperação...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-2xl font-bold text-red-600">Link Inválido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 space-y-4">
              <div className="bg-red-100 text-red-600 rounded-full p-3 w-fit mx-auto">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">Link Expirado ou Inválido</h3>
                <p className="text-gray-600">
                  {error || "O link de recuperação não é válido ou já expirou."}
                </p>
              </div>
              <Link href="/forgot-password">
                <Button className="w-full mt-4">Solicitar Novo Link</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/login" className="text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CardTitle className="text-2xl font-bold">Redefinir Password</CardTitle>
          </div>
          <CardDescription>
            Escolha uma nova password forte e segura para a sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="bg-green-100 text-green-600 rounded-full p-3 w-fit mx-auto">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">Password Redefinida!</h3>
                <p className="text-gray-600">
                  A sua password foi alterada com sucesso. A redirecionar para o login...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nova Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite a nova password"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Digite novamente a nova password"
                    className="pl-10 pr-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
                <p className="font-semibold mb-2">Requisitos da password:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Mínimo de 8 caracteres</li>
                  <li>Pelo menos uma letra maiúscula</li>
                  <li>Pelo menos uma letra minúscula</li>
                  <li>Pelo menos um número</li>
                  <li>Pelo menos um caractere especial (!@#$%^&*)</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "A redefinir..." : "Redefinir Password"}
              </Button>
            </form>
          )}
        </CardContent>
        {!isSuccess && (
          <CardFooter className="flex justify-center border-t pt-6">
            <p className="text-sm text-gray-600">
              Lembrou-se da password?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Entrar agora
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}