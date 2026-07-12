import { useState } from "react";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, BedDouble, Bath, Ruler, Phone, Mail, CheckCircle2, MessageCircle } from "lucide-react";

interface FormQuestion {
  id: string;
  label: string;
  field_type: "text" | "textarea" | "select" | "number" | "phone";
  options: string[];
  required: boolean;
}

interface LandingData {
  type: "property" | "development";
  entity: Record<string, any>;
  agent: { name: string | null; email: string | null; phone: string | null; avatar: string | null } | null;
  questions: FormQuestion[];
}

interface PageProps {
  data: LandingData | null;
  url: string;
  token: string;
}

function formatPrice(value?: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

// Renderização no servidor: garante que os meta tags de SEO/partilha (Open
// Graph) estão no HTML inicial — os scrapers do WhatsApp/Facebook não correm
// JavaScript, por isso a pré-visualização só funciona assim.
export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const token = ctx.params?.token as string;
  const host = ctx.req.headers.host;
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const url = `${origin}/l/${token}`;

  try {
    const res = await fetch(`${origin}/api/landing/${token}`);
    if (!res.ok) return { props: { data: null, url, token } };
    const data = (await res.json()) as LandingData;
    return { props: { data, url, token } };
  } catch {
    return { props: { data: null, url, token } };
  }
};

export default function LandingPage({ data, url, token }: PageProps) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", company: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || (!form.email && !form.phone)) {
      setFormError("Indique o seu nome e email ou telefone.");
      return;
    }
    const missing = (data?.questions || []).find((q) => q.required && !answers[q.id]?.trim());
    if (missing) {
      setFormError(`Preencha: ${missing.label}`);
      return;
    }
    setSubmitting(true);
    try {
      const answerPayload = (data?.questions || [])
        .map((q) => ({ label: q.label, answer: answers[q.id] || "" }))
        .filter((a) => a.answer);
      const r = await fetch(`/api/landing/${token}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, answers: answerPayload }),
      });
      if (!r.ok) throw new Error();
      setSent(true);
    } catch {
      setFormError("Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) {
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

  // SEO automático: título e descrição compostos a partir dos dados do imóvel.
  const seoTitle = [title, price, e.city].filter(Boolean).join(" · ");
  const seoDescription = (e.description
    ? String(e.description)
    : `${title}${location ? ` em ${location}` : ""}${price ? ` — ${price}` : ""}. Peça mais informações.`
  ).slice(0, 200);
  const ogImage = gallery[0] || "";

  // CTA de WhatsApp para o agente (se tiver telefone).
  const waPhone = data.agent?.phone ? data.agent.phone.replace(/[^0-9]/g, "") : "";
  const waHref = waPhone
    ? `https://wa.me/${waPhone.startsWith("351") ? waPhone : "351" + waPhone}?text=${encodeURIComponent(`Olá, tenho interesse em "${title}".`)}`
    : "";

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={url} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Head>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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

                {/* CTA — visível de imediato, especialmente em telemóvel */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href="#contacto">
                    <Button className="gap-2">Tenho interesse</Button>
                  </a>
                  {waHref && (
                    <a href={waHref} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {data.agent?.phone && (
                    <a href={`tel:${data.agent.phone}`}>
                      <Button variant="outline" className="gap-2"><Phone className="h-4 w-4" /> Ligar</Button>
                    </a>
                  )}
                </div>

                {e.description && (
                  <div className="prose max-w-none text-slate-700 whitespace-pre-wrap">{e.description}</div>
                )}
              </div>

              <div className="md:col-span-1" id="contacto">
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
                        <div className="flex items-center gap-3 mb-4">
                          {data.agent.avatar && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={data.agent.avatar} alt={data.agent.name} className="h-10 w-10 rounded-full object-cover" />
                          )}
                          <p className="text-sm text-slate-500">Fale com {data.agent.name}</p>
                        </div>
                      )}
                      <form onSubmit={handleSubmit} className="space-y-3">
                        <input type="text" name="company" value={form.company} onChange={(ev) => setForm({ ...form, company: ev.target.value })} className="hidden" tabIndex={-1} autoComplete="off" />
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
                        {(data.questions || []).map((q) => (
                          <div key={q.id}>
                            <Label>{q.label}{q.required ? " *" : ""}</Label>
                            {q.field_type === "textarea" ? (
                              <Textarea rows={2} value={answers[q.id] || ""} onChange={(ev) => setAnswers((p) => ({ ...p, [q.id]: ev.target.value }))} />
                            ) : q.field_type === "select" ? (
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                value={answers[q.id] || ""}
                                onChange={(ev) => setAnswers((p) => ({ ...p, [q.id]: ev.target.value }))}
                              >
                                <option value="">Selecione…</option>
                                {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <Input
                                type={q.field_type === "number" ? "number" : q.field_type === "phone" ? "tel" : "text"}
                                value={answers[q.id] || ""}
                                onChange={(ev) => setAnswers((p) => ({ ...p, [q.id]: ev.target.value }))}
                              />
                            )}
                          </div>
                        ))}
                        <div>
                          <Label htmlFor="message">Mensagem</Label>
                          <Textarea id="message" rows={3} value={form.message} onChange={(ev) => setForm({ ...form, message: ev.target.value })} />
                        </div>
                        {formError && <p className="text-sm text-red-600">{formError}</p>}
                        <Button type="submit" className="w-full" disabled={submitting}>
                          {submitting ? "A enviar..." : "Enviar"}
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
