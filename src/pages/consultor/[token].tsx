import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Loader2, Phone, Mail, MapPin } from "lucide-react";

interface AgentLanding {
  agent: { name: string | null; email: string | null; phone: string | null; avatar: string | null; headline: string | null; bio: string | null };
  listings: Array<{ title: string; price: number | null; city: string | null; image: string | null; token: string; kind: string }>;
}

function formatPrice(v?: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

export default function AgentLandingPage() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState<AgentLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token || typeof token !== "string") return;
    fetch(`/api/consultor/${token}`)
      .then(async (r) => { if (!r.ok) { setNotFound(true); return; } setData(await r.json()); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
        <div><h1 className="text-2xl font-bold text-slate-900">Página não disponível</h1>
        <p className="text-slate-500 mt-2">Este perfil não existe ou não está publicado.</p></div>
      </div>
    );
  }

  const a = data.agent;
  return (
    <>
      <Head><title>{a.name || "Consultor"}</title>{a.headline && <meta name="description" content={a.headline} />}</Head>
      <div className="min-h-screen bg-slate-50">
        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            {a.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.avatar} alt={a.name || ""} className="h-28 w-28 rounded-full object-cover border-4 border-white/30" />
            ) : (
              <div className="h-28 w-28 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
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
