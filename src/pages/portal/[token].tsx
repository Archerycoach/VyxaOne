import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { MapPin, Bed, Bath, Maximize, Calendar, FileText, Phone, Mail, Home, Clock } from "lucide-react";

interface PortalProperty {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  main_image_url: string | null;
  reference_code: string | null;
  property_type: string;
}

interface PortalMatch {
  match_score: number | null;
  match_reasons: string[] | null;
  property: PortalProperty | null;
}

interface PortalEvent {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
  event_type: string | null;
}

interface PortalDocument {
  id: string;
  name: string;
  file_type: string | null;
  created_at: string;
  url: string | null;
}

interface PortalExternalListing {
  id: string;
  title: string;
  url: string;
  image_url: string | null;
  price: number | null;
}

interface PortalData {
  leadName: string;
  consultant: { full_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
  matches: PortalMatch[];
  externalListings: PortalExternalListing[];
  upcomingEvents: PortalEvent[];
  documents: PortalDocument[];
}

function formatCurrency(value: number | null): string {
  if (!value) return "Sob consulta";
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }) +
    " às " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientPortalPage() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || typeof token !== "string") return;

    const load = async () => {
      try {
        const res = await fetch(`/api/portal/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Não foi possível carregar este link.");
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <>
      <Head>
        <title>{data ? `O seu processo — ${data.leadName}` : "Portal do Cliente"}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <div
        style={{
          minHeight: "100vh",
          background: "#F6F1E8",
          fontFamily: "'Inter', sans-serif",
          color: "#22303A",
        }}
      >
        {loading && (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#5B6B74" }}>A abrir o seu processo...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <Home size={40} color="#3B6E8F" style={{ marginBottom: 16 }} />
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, marginBottom: 8 }}>Este link já não está disponível</h1>
            <p style={{ color: "#5B6B74", maxWidth: 400 }}>{error}. Contacte o seu consultor para obter um novo link.</p>
          </div>
        )}

        {data && !loading && (
          <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px" }}>
            {/* Header */}
            <header style={{ marginBottom: 56 }}>
              <p style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12, color: "#3B6E8F", fontWeight: 600, marginBottom: 10 }}>
                O seu processo
              </p>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 500, lineHeight: 1.15, margin: 0, color: "#1A2B3C" }}>
                Olá, {data.leadName.split(" ")[0]}
              </h1>
              <p style={{ color: "#5B6B74", fontSize: 16, marginTop: 10, maxWidth: 560 }}>
                Aqui encontra os imóveis que selecionei para si, as próximas visitas, e os documentos que partilhei consigo.
              </p>
            </header>

            {/* Consultant card */}
            {data.consultant && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "#FFFFFF",
                  border: "1px solid #E8E0D2",
                  borderRadius: 14,
                  padding: "18px 22px",
                  marginBottom: 48,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#3B6E8F",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Fraunces', serif",
                    fontSize: 18,
                    flexShrink: 0,
                    backgroundImage: data.consultant.avatar_url ? `url(${data.consultant.avatar_url})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!data.consultant.avatar_url && (data.consultant.full_name?.charAt(0) || "C")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>{data.consultant.full_name}</p>
                  <p style={{ color: "#5B6B74", fontSize: 13, margin: "2px 0 0" }}>O seu consultor</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {data.consultant.phone && (
                    <a
                      href={`https://wa.me/${data.consultant.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: 38, height: 38, borderRadius: "50%", background: "#F6F1E8", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B6E8F" }}
                      aria-label="WhatsApp"
                    >
                      <Phone size={16} />
                    </a>
                  )}
                  <a
                    href={`mailto:${data.consultant.email}`}
                    style={{ width: 38, height: 38, borderRadius: "50%", background: "#F6F1E8", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B6E8F" }}
                    aria-label="Email"
                  >
                    <Mail size={16} />
                  </a>
                </div>
              </div>
            )}

            {/* Upcoming visits */}
            {data.upcomingEvents.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <SectionTitle icon={<Calendar size={18} />}>Próximas visitas</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E8E0D2",
                        borderRadius: 12,
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <Clock size={18} color="#B8935A" style={{ flexShrink: 0 }} />
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, margin: 0, textTransform: "capitalize" }}>{formatEventDate(event.start_time)}</p>
                        <p style={{ color: "#5B6B74", fontSize: 13, margin: "2px 0 0" }}>
                          {event.title}{event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Matched properties */}
            <section style={{ marginBottom: 48 }}>
              <SectionTitle icon={<Home size={18} />}>Imóveis para si</SectionTitle>
              {data.matches.length === 0 && (data.externalListings || []).length === 0 ? (
                <EmptyNote>Ainda estamos a preparar as melhores opções para si — em breve terá novidades aqui.</EmptyNote>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                  {(data.externalListings || []).map((ext) => (
                    <a
                      key={ext.id}
                      href={ext.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "#FFFFFF", border: "1px solid #E8E0D2", borderRadius: 14, overflow: "hidden", textDecoration: "none", color: "inherit" }}
                    >
                      <div style={{ height: 150, background: ext.image_url ? `url(${ext.image_url}) center/cover` : "#E8E0D2", display: "flex", alignItems: "flex-end" }}>
                        {ext.price != null && (
                          <span style={{ background: "#1A2B3C", color: "#F6F1E8", fontSize: 15, fontWeight: 600, padding: "5px 12px", borderRadius: "0 8px 0 0" }}>
                            {formatCurrency(ext.price)}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: "14px 16px" }}>
                        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500, margin: "0 0 4px", lineHeight: 1.3 }}>{ext.title}</p>
                        <p style={{ color: "#3B6E8F", fontSize: 12.5, margin: 0 }}>Ver anúncio →</p>
                      </div>
                    </a>
                  ))}
                  {data.matches.map((match, i) => {
                    const p = match.property;
                    if (!p) return null;
                    return (
                      <div
                        key={p.id || i}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E8E0D2",
                          borderRadius: 14,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: 150,
                            background: p.main_image_url ? `url(${p.main_image_url}) center/cover` : "#E8E0D2",
                            display: "flex",
                            alignItems: "flex-end",
                          }}
                        >
                          <span
                            style={{
                              background: "#1A2B3C",
                              color: "#F6F1E8",
                              fontSize: 15,
                              fontWeight: 600,
                              padding: "5px 12px",
                              borderRadius: "0 8px 0 0",
                            }}
                          >
                            {formatCurrency(p.price)}
                          </span>
                        </div>
                        <div style={{ padding: "14px 16px" }}>
                          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500, margin: "0 0 4px", lineHeight: 1.3 }}>{p.title}</p>
                          {(p.address || p.city) && (
                            <p style={{ display: "flex", alignItems: "center", gap: 4, color: "#5B6B74", fontSize: 12.5, margin: "0 0 10px" }}>
                              <MapPin size={12} /> {[p.address, p.city].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: 12, color: "#5B6B74", fontSize: 12.5 }}>
                            {p.bedrooms != null && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Bed size={13} /> {p.bedrooms}</span>
                            )}
                            {p.bathrooms != null && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Bath size={13} /> {p.bathrooms}</span>
                            )}
                            {p.area != null && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Maximize size={13} /> {p.area} m²</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Documents */}
            {data.documents.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <SectionTitle icon={<FileText size={18} />}>Documentos</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "#FFFFFF",
                        border: "1px solid #E8E0D2",
                        borderRadius: 10,
                        padding: "12px 16px",
                        textDecoration: "none",
                        color: "#22303A",
                      }}
                    >
                      <FileText size={16} color="#3B6E8F" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{doc.name}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <footer style={{ textAlign: "center", marginTop: 64, color: "#A3ADB2", fontSize: 12 }}>
              Este link é pessoal — evite partilhá-lo com terceiros.
            </footer>
          </div>
        )}
      </div>
    </>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ color: "#B8935A" }}>{icon}</span>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0, color: "#1A2B3C" }}>{children}</h2>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px dashed #E8E0D2", borderRadius: 12, padding: "24px", textAlign: "center", color: "#5B6B74", fontSize: 14 }}>
      {children}
    </div>
  );
}
