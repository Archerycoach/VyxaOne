import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Mails, ArrowLeft, Save, Info } from "lucide-react";

// Valores por defeito (têm de coincidir com os do bulkEmailWorker.ts).
const DEFAULTS = { bulk_batch_size: 100, bulk_rate_limit_per_sec: 8, bulk_cooldown_minutes: 60 };
const BOUNDS = {
  bulk_batch_size: { min: 1, max: 1000 },
  bulk_rate_limit_per_sec: { min: 1, max: 100 },
  bulk_cooldown_minutes: { min: 1, max: 1440 },
};

export default function BulkEmailSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [values, setValues] = useState(DEFAULTS);

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${session?.access_token}` } });
  };

  useEffect(() => {
    (async () => {
      try {
        const keys = Object.keys(DEFAULTS).join(",");
        const res = await adminFetch(`/api/admin/system-settings?keys=${keys}`);
        const body = await res.json();
        if (res.ok) {
          setValues({
            bulk_batch_size: Number(body.bulk_batch_size) || DEFAULTS.bulk_batch_size,
            bulk_rate_limit_per_sec: Number(body.bulk_rate_limit_per_sec) || DEFAULTS.bulk_rate_limit_per_sec,
            bulk_cooldown_minutes: Number(body.bulk_cooldown_minutes) || DEFAULTS.bulk_cooldown_minutes,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (k: keyof typeof DEFAULTS, v: string) => setValues((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));

  const clamp = (k: keyof typeof DEFAULTS) => Math.max(BOUNDS[k].min, Math.min(BOUNDS[k].max, values[k] || DEFAULTS[k]));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        bulk_batch_size: String(clamp("bulk_batch_size")),
        bulk_rate_limit_per_sec: String(clamp("bulk_rate_limit_per_sec")),
        bulk_cooldown_minutes: String(clamp("bulk_cooldown_minutes")),
      };
      const res = await adminFetch("/api/admin/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha ao guardar");
      setValues({
        bulk_batch_size: Number(payload.bulk_batch_size),
        bulk_rate_limit_per_sec: Number(payload.bulk_rate_limit_per_sec),
        bulk_cooldown_minutes: Number(payload.bulk_cooldown_minutes),
      });
      setMsg({ type: "success", text: "Configuração guardada. Aplica-se às campanhas seguintes." });
    } catch (error: any) {
      setMsg({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const perHour = Math.round((values.bulk_rate_limit_per_sec || DEFAULTS.bulk_rate_limit_per_sec) * 3600);

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/admin/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Mails className="h-6 w-6 text-blue-600" /> Envio em Massa</h1>
              <p className="text-slate-600 text-sm">Ritmo de envio das campanhas (mala-direta). Saem sempre pelo SMTP do consultor.</p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              As campanhas saem <strong>em blocos espaçados no tempo</strong> pela caixa do consultor. Se o servidor
              devolver um limite de envio, a fila faz uma pausa e retoma — uma campanha grande pode levar horas ou dias,
              sem perder emails. Valores mais baixos = mais suave (menos risco de spam/limites), mais lento.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parâmetros de ritmo</CardTitle>
              <CardDescription>Cerca de {perHour.toLocaleString("pt-PT")} emails/hora no máximo por consultor (o limite real da caixa RE/MAX pode ser inferior).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <p className="text-sm text-slate-500">A carregar…</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Emails por ciclo (bloco)</Label>
                    <Input type="number" min={1} max={1000} value={values.bulk_batch_size}
                      onChange={(e) => setField("bulk_batch_size", e.target.value)} className="w-40" />
                    <p className="text-xs text-slate-500">Quantos emails a fila processa de cada vez. Default {DEFAULTS.bulk_batch_size}.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ritmo (mensagens por segundo)</Label>
                    <Input type="number" min={1} max={100} value={values.bulk_rate_limit_per_sec}
                      onChange={(e) => setField("bulk_rate_limit_per_sec", e.target.value)} className="w-40" />
                    <p className="text-xs text-slate-500">Teto de envio por segundo, por consultor. Default {DEFAULTS.bulk_rate_limit_per_sec}. Baixar torna o envio mais gradual.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pausa após limite do servidor (minutos)</Label>
                    <Input type="number" min={1} max={1440} value={values.bulk_cooldown_minutes}
                      onChange={(e) => setField("bulk_cooldown_minutes", e.target.value)} className="w-40" />
                    <p className="text-xs text-slate-500">Quando a caixa devolve "limite excedido", a fila espera este tempo antes de tentar de novo. Default {DEFAULTS.bulk_cooldown_minutes} (1h).</p>
                  </div>

                  {msg && (
                    <Alert className={msg.type === "success" ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}>
                      <AlertDescription className={msg.type === "success" ? "text-green-800" : "text-red-800"}>{msg.text}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1.5" /> {saving ? "A guardar…" : "Guardar"}</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
