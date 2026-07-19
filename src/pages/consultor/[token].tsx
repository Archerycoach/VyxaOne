import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { Phone, Mail, MapPin, CalendarDays } from "lucide-react";

interface AgentLanding {
  agent: {
    name: string | null;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    headline: string | null;
    bio: string | null;
    /** Token da página pública de agendamento, quando ativa. */
    bookingToken?: string | null;
  };
  listings: Array<{ title: string; price: number | null; city: string | null; image: string | null; token: string; kind: string }>;
}

interface PageProps {
  data: AgentLanding | null;
  url: string;
}

function formatPrice(v?: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

// Renderização no servidor para SEO/partilha (Open Graph) no HTML inicial.
export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const token = ctx.params?.token as string;
  const host = ctx.req.headers.host;
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const url = `${origin}/consultor/${token}`;
  try {
    const res = await fetch(`${origin}/api/consultor/${token}`);
    if (!res.ok) return { props: { data: null, url } };
    return { props: { data: (await res.json()) as AgentLanding, url } };
  } catch {
    return { props: { data: null, url } };
  }
};

export default function AgentLandingPage({ data, url }: PageProps) {
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
        <div><h1 className="text-2xl font-bold text-slate-900">Página não disponível</h1>
        <p className="text-slate-500 mt-2">Este perfil não existe ou não está publicado.</p></div>
      </div>
    );
  }

  const a = data.agent;
  const seoTitle = [a.name, a.headline].filter(Boolean).join(" — ") || "Consultor Imobiliário";
  const seoDescription = (a.bio || a.headline || `${a.name} — consultor imobiliário. Veja os imóveis disponíveis e contacte diretamente.`).slice(0, 200);
  const ogImage = a.avatar || "";

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={url} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? "summary" : "summary"} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Head>
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            {a.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.avatar} alt={a.name || ""} className="h-44 w-44 rounded-full object-cover object-top border-4 border-white/30 shadow-lg shrink-0" />
            ) : (
              <div className="h-44 w-44 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold shrink-0">
                {(a.name || "?").charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{a.name}</h1>
              {a.headline && <p className="text-blue-100 mt-1 text-lg">{a.headline}</p>}
              <div className="flex flex-wrap gap-4 mt-3 justify-center sm:justify-start text-sm text-blue-50">
                {a.phone && <a href={`tel:${a.phone}`} className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {a.phone}</a>}
                {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {a.email}</a>}
              </div>

              {/* Marcação direta na agenda do consultor */}
              {a.bookingToken && (
                <a
                  href={`/agendar/${a.bookingToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                  <CalendarDays className="h-4 w-4" />
                  Marcar reunião
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
          {a.bio && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">Sobre mim</h2>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{a.bio}</p>
            </section>
          )}

          {data.listings.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Imóveis em destaque</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.listings.map((l) => (
                  <Link key={l.token} href={`/l/${l.token}`} className="block bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt={l.title} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-slate-100" />
                    )}
                    <div className="p-3">
                      <p className="font-medium text-slate-900 truncate">{l.title}</p>
                      {l.city && <p className="text-sm text-slate-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {l.city}</p>}
                      {formatPrice(l.price) && <p className="text-blue-700 font-semibold mt-1">{formatPrice(l.price)}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
