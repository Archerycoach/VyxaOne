import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Calendar, Clock, CheckCircle2, Home } from "lucide-react";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
}

interface BookingData {
  consultant: { full_name: string; avatar_url: string | null; email: string | null; phone: string | null };
  slots: Slot[];
}

function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
}

function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function BookingPage() {
  const router = useRouter();
  const { token } = router.query;

  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!token || typeof token !== "string") return;

    const load = async () => {
      try {
        const res = await fetch(`/api/booking/${token}/slots`);
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

  const handleConfirm = async () => {
    if (!selectedSlot || !name.trim() || !email.trim() || typeof token !== "string") return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/booking/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedSlot.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível confirmar a reserva.");
      setConfirmed(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const slotsByDay = (data?.slots || []).reduce<Record<string, Slot[]>>((acc, slot) => {
    const day = formatDayLabel(slot.start_time);
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {});

  return (
    <>
      <Head>
        <title>{data ? `Marcar conversa com ${data.consultant.full_name}` : "Marcar conversa"}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ minHeight: "100vh", background: "#F6F1E8", fontFamily: "'Inter', sans-serif", color: "#22303A" }}>
        {loading && (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#5B6B74" }}>A carregar horários disponíveis...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <Home size={40} color="#3B6E8F" style={{ marginBottom: 16 }} />
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, marginBottom: 8 }}>Este link já não está disponível</h1>
            <p style={{ color: "#5B6B74", maxWidth: 400 }}>{error}</p>
          </div>
        )}

        {data && !loading && !error && (
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px" }}>
            <header style={{ marginBottom: 40 }}>
              <p style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12, color: "#3B6E8F", fontWeight: 600, marginBottom: 10 }}>
                Marcar conversa
              </p>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 500, lineHeight: 1.15, margin: 0, color: "#1A2B3C" }}>
                {confirmed ? "Reserva confirmada!" : `Marque 30 minutos com ${data.consultant.full_name}`}
              </h1>
              {!confirmed && (
                <p style={{ color: "#5B6B74", fontSize: 16, marginTop: 10 }}>
                  Escolha o horário que lhe é mais conveniente.
                </p>
              )}
            </header>

            {confirmed ? (
              <div style={{ background: "#FFFFFF", border: "1px solid #E8E0D2", borderRadius: 14, padding: 32, textAlign: "center" }}>
                <CheckCircle2 size={40} color="#3B6E8F" style={{ marginBottom: 16 }} />
                <p style={{ fontSize: 16, marginBottom: 6 }}>
                  <strong>{formatDayLabel(selectedSlot!.start_time)}</strong>, às {formatTimeLabel(selectedSlot!.start_time)}
                </p>
                <p style={{ color: "#5B6B74", fontSize: 14 }}>
                  Enviámos um email de confirmação para {email}.
                </p>
              </div>
            ) : !selectedSlot ? (
              data.slots.length === 0 ? (
                <div style={{ background: "#FFFFFF", border: "1px solid #E8E0D2", borderRadius: 14, padding: 32, textAlign: "center", color: "#5B6B74" }}>
                  <p style={{ margin: 0 }}>
                    Não há horários disponíveis neste momento. Contacte diretamente {data.consultant.full_name}.
                  </p>
                  {(data.consultant.email || data.consultant.phone) && (
                    <p style={{ margin: "10px 0 0", color: "#22303A" }}>
                      {data.consultant.phone && (
                        <a href={`tel:${data.consultant.phone}`} style={{ color: "#3B6E8F", textDecoration: "none" }}>
                          {data.consultant.phone}
                        </a>
                      )}
                      {data.consultant.phone && data.consultant.email && " · "}
                      {data.consultant.email && (
                        <a href={`mailto:${data.consultant.email}`} style={{ color: "#3B6E8F", textDecoration: "none" }}>
                          {data.consultant.email}
                        </a>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {Object.entries(slotsByDay).map(([day, slots]) => (
                    <div key={day}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#3B6E8F" }}>
                        <Calendar size={16} />
                        <span style={{ fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>{day}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {slots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "10px 16px",
                              borderRadius: 10,
                              border: "1px solid #E8E0D2",
                              background: "#FFFFFF",
                              color: "#22303A",
                              fontSize: 14,
                              cursor: "pointer",
                            }}
                          >
                            <Clock size={14} />
                            {formatTimeLabel(slot.start_time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ background: "#FFFFFF", border: "1px solid #E8E0D2", borderRadius: 14, padding: 24 }}>
                <p style={{ marginBottom: 16, fontSize: 15 }}>
                  <strong style={{ textTransform: "capitalize" }}>{formatDayLabel(selectedSlot.start_time)}</strong>, às {formatTimeLabel(selectedSlot.start_time)}
                  {" — "}
                  <button
                    onClick={() => setSelectedSlot(null)}
                    style={{ color: "#3B6E8F", background: "none", border: "none", cursor: "pointer", fontSize: 14, textDecoration: "underline" }}
                  >
                    escolher outro horário
                  </button>
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    placeholder="O seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#000000", color: "#FFFFFF" }}
                  />
                  <input
                    type="email"
                    placeholder="O seu email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#000000", color: "#FFFFFF" }}
                  />
                  <input
                    placeholder="O seu telefone (opcional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#000000", color: "#FFFFFF" }}
                  />

                  {submitError && <p style={{ color: "#B3403E", fontSize: 13 }}>{submitError}</p>}

                  <button
                    onClick={handleConfirm}
                    disabled={submitting || !name.trim() || !email.trim()}
                    style={{
                      marginTop: 8,
                      padding: "12px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: submitting || !name.trim() || !email.trim() ? "#A9C2D1" : "#3B6E8F",
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: submitting || !name.trim() || !email.trim() ? "default" : "pointer",
                    }}
                  >
                    {submitting ? "A confirmar..." : "Confirmar reserva"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
