import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, BedDouble, Bath, Ruler, Phone, Mail, CheckCircle2 } from "lucide-react";

interface LandingData {
  type: "property" | "development";
  entity: Record<string, any>;
  agent: { name: string | null; email: string | null; phone: string | null } | null;
}

function formatPrice(value?: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export default function LandingPage() {
  const router = useRouter();
  const { token } = router.query;

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", company: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token || typeof token !== "string") return;
    fetch(`/api/landing/${token}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        setData(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || (!form.email && !form.phone)) {
      setFormError("Indique o seu nome e email ou telefone.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/landing/${token}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      setSent(true);
    } catch {
      setFormError("Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Página não disponível</h1>
          <p className="text-slate-500 mt-2">Este anúncio não existe ou já não está publicado.</p>
        </div>
      </div>
    );
  }

  const e = data.entity;
  const isProperty = data.type === "property";
  const title = isProperty ? e.title : e.name;
  const price = isProperty ? formatPrice(e.price) : (e.price_from ? `Desde ${formatPrice(e.price_from)}` : null);
  const location = [e.address, e.district, e.city].filter(Boolean).join(", ");
  const gallery: string[] = [e.main_image_url, ...(e.images || [])].filter(Boolean);

  return (
    <>
      <Head>
        <title>{title}</title>
        {e.description && <meta name="description" content={String(e.description).slice(0, 160)} />}
      </Head>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Galeria */}
            {gallery.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gallery[0]} alt={title} className="w-full h-72 md:h-96 object-cover md:col-span-2" />
                {gallery.slice(1, 5).map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img} alt={`${title} ${i + 2}`} className="w-full h-40 object-cover" />
                ))}
              </div>
            ) : (
              <div className="h-72 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-slate-400">
                Sem fotografias
              </div>
            )}

            <div className="p-6 md:p-8 grid md:grid-cols-3 gap-8">
              {/* Detalhes */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
                  {location && (
                    <p className="text-slate-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="h-4 w-4" /> {location}
                    </p>
                  )}
                </div>
                {price && <p className="text-2xl font-bold text-blue-700">{price}</p>}

                {isProperty && (
                  <div className="flex flex-wrap gap-4 text-slate-600 text-sm">
                    {e.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {e.bedrooms} quartos</span>}
                    {e.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {e.bathrooms} WC</span>}
                    {e.area != null && <span className="flex items-center gap-1"><Ruler className="h-4 w-4" /> {e.area} m²</span>}
                  </div>
                )}

                {e.description && (
                  <div className="prose max-w-none text-slate-700 whitespace-pre-wrap">{e.description}</div>
                )}
              </div>

              {/* Formulário de contacto */}
              <div className="md:col-span-1">
                <div className="border rounded-lg p-5 bg-slate-50 sticky top-8">
                  {sent ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                      <p className="font-medium text-slate-900">Contacto enviado!</p>
                      <p className="text-sm text-slate-500 mt-1">Entraremos em contacto em breve.</p>
                    </div>
                  ) : (
                    <>
                      <h2 className="font-semibold text-slate-900 mb-1">Tenho interesse</h2>
                      {data.agent?.name && (
                        <p className="text-sm text-slate-500 mb-4">Fale com {data.agent.name}</p>
                      )}
                      <form onSubmit={handleSubmit} className="space-y-3">
                        {/* honeypot escondido */}
                        <input
                          type="text"
                          name="company"
                          value={form.company}
                          onChange={(ev) => setForm({ ...form, company: ev.target.value })}
                          className="hidden"
                          tabIndex={-1}
                          autoComplete="off"
                        />
                        <div>
                          <Label htmlFor="name">Nome *</Label>
                          <Input id="name" value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} required />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
                        </div>
                        <div>
                          <Label htmlFor="phone">Telefone</Label>
                          <Input id="phone" value={form.phone} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} />
                        </div>
                        <div>
                          <Label htmlFor="message">Mensagem</Label>
                          <Textarea id="message" rows={3} value={form.message} onChange={(ev) => setForm({ ...form, message: ev.target.value })} />
                        </div>
                        {formError && <p className="text-sm text-red-600">{formError}</p>}
                        <Button type="submit" className="w-full" disabled={submitting}>
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                        </Button>
                      </form>
                      {(data.agent?.phone || data.agent?.email) && (
                        <div className="mt-4 pt-4 border-t text-sm text-slate-600 space-y-1">
                          {data.agent.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {data.agent.phone}</p>}
                          {data.agent.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {data.agent.email}</p>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
