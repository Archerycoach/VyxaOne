import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Mail, Lock, Loader2 } from "lucide-react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, getCurrentUser } from "@/services/authService";
import { supabase } from "@/integrations/supabase/client";
import Link from "next/link";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  
  const [success, setSuccess] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error checking existing session:", error);
      // User needs to login, stay on login page
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("Login: Attempting login for:", loginEmail);
      
      const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (signInError) {
        console.error("Login: Sign in error:", signInError);
        throw signInError;
      }

      if (!session) {
        console.error("Login: No session returned after sign in");
        throw new Error("Erro ao criar sessão");
      }

      console.log("Login: Session created successfully", {
        user: session.user.email,
        expires_at: session.expires_at
      });

      // Verificar se perfil existe, caso contrário criar
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .single();

      if (!profile) {
        console.log("Login: Creating profile for new user");
        const { error: profileError } = await supabase
          .from("profiles")
          .insert([
            {
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.email?.split("@")[0] || "",
              role: "agent",
            },
          ]);

        if (profileError) {
          console.error("Login: Error creating profile:", profileError);
        }
      }

      toast({
        title: "Sucesso!",
        description: "Login realizado com sucesso",
      });

      console.log("Login: Redirecting to dashboard...");
      
      // Hard redirect para garantir que a sessão seja carregada corretamente
      window.location.href = "/dashboard";
      
      console.log("Login: Redirect initiated");
    } catch (err: any) {
      console.error("Login: Unexpected error:", err);
      setError(err.message || "Erro ao fazer login");
      toast({
        title: "Erro",
        description: err.message || "Erro ao fazer login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("🔵 [Login] Starting registration process...");
    console.log("🔵 [Login] Form data:", {
      email: signupEmail,
      name: signupName,
      passwordLength: signupPassword.length
    });

    // Validation
    if (!signupName || !signupEmail || !signupPassword) {
      console.log("❌ [Login] Form validation failed: missing fields");
      setError("Por favor, preencha todos os campos");
      setLoading(false);
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      console.log("❌ [Login] Form validation failed: passwords don't match");
      setError("As palavras-passe não coincidem");
      setLoading(false);
      return;
    }

    if (signupPassword.length < 6) {
      console.log("❌ [Login] Form validation failed: password too short");
      setError("A palavra-passe deve ter pelo menos 6 caracteres");
      setLoading(false);
      return;
    }

    console.log("✅ [Login] Form validation passed");

    try {
      console.log("🔵 [Login] Calling signUpWithEmail...");
      await signUpWithEmail(signupEmail, signupPassword, signupName);
      
      console.log("✅ [Login] Account created successfully");
      
      // Clear signup form
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupConfirmPassword("");
      
      // Clear any errors
      setError("");
      
      // Switch to login tab
      setActiveTab("login");
      setIsLogin(true);
      
      // Pre-fill email in login form for convenience
      setLoginEmail(signupEmail);
      setLoginPassword("");
      
      // Show success notification
      alert("✅ Conta criada com sucesso! Por favor, faça login para continuar.");
      
      console.log("🔵 [Login] Switched to login tab, user must login manually");
    } catch (error: any) {
      console.error("❌ [Login] Registration error:", error);
      setError(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
      console.log("🔵 [Login] Registration process completed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="absolute top-4 right-4">
        <ThemeSwitch />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Bem-vindo</CardTitle>
          <CardDescription className="text-center">
            Entre na sua conta ou crie uma nova
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login-password">Palavra-passe</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A entrar...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="João Silva"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-password">Palavra-passe</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-confirm-password">Confirmar Palavra-passe</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="Repita a palavra-passe"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A criar conta...
                    </>
                  ) : (
                    "Criar Conta"
                  )}
                </Button>

                {/* Google OAuth - Temporarily disabled until configured in Supabase
                <div className="relative my-4">
                </div>
                */}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-blue-200 mt-4">
        Sistema seguro com encriptação de dados
      </p>
    </div>
  );
}