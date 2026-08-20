import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Calendar, Clock, CheckCircle2, Home, ChevronLeft, ChevronRight } from "lucide-react";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
}

interface BookingQuestion {
  id: string;
  label: string;
  field_type: "text" | "textarea" | "select" | "number" | "phone";
  options: string[];
  required: boolean;
}

interface BookingData {
  consultant: { full_name: string; avatar_url: string | null; email: string | null; phone: string | null };
  slots: Slot[];
  questions: BookingQuestion[];
}

function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
}

function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

/** Chave de dia local ("2026-07-25") — agrupa slots por dia no calendário. */
function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Matriz do mês (semana a começar 2ª feira); células null para o preenchimento. */
function buildMonthMatrix(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // 0 = segunda
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function BookingPage() {
  const router = useRouter();
  const { token } = router.query;

  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

    const missing = (data?.questions || []).find((q) => q.required && !answers[q.id]?.trim());
    if (missing) {
      setSubmitError(`Preencha: ${missing.label}`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const answerPayload = (data?.questions || [])
        .map((q) => ({ label: q.label, answer: answers[q.id] || "" }))
        .filter((a) => a.answer);
      const res = await fetch(`/api/booking/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedSlot.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          answers: answerPayload,
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

  // Slots agrupados por dia (chave "YYYY-MM-DD") + dias com disponibilidade.
  const sortedSlots = [...(data?.slots || [])].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  const slotsByDayKey = sortedSlots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const key = dayKeyOf(slot.start_time);
    (acc[key] = acc[key] || []).push(slot);
    return acc;
  }, {});
  const availableDayKeys = new Set(Object.keys(slotsByDayKey));
  const firstSlotDate = sortedSlots.length ? new Date(sortedSlots[0].start_time) : null;
  const lastSlotDate = sortedSlots.length ? new Date(sortedSlots[sortedSlots.length - 1].start_time) : null;

  // Ao carregar os horários, abrir o calendário no 1.º mês com vagas e
  // pré-selecionar o 1.º dia disponível.
  useEffect(() => {
    if (!firstSlotDate) return;
    setViewMonth((prev) => prev || new Date(firstSlotDate.getFullYear(), firstSlotDate.getMonth(), 1));
    setSelectedDay((prev) => prev || dayKeyOfDate(firstSlotDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const canGoPrev =
    !!viewMonth && !!firstSlotDate &&
    viewMonth > new Date(firstSlotDate.getFullYear(), firstSlotDate.getMonth(), 1);
  const canGoNext =
    !!viewMonth && !!lastSlotDate &&
    viewMonth < new Date(lastSlotDate.getFullYear(), lastSlotDate.getMonth(), 1);
  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => (prev ? new Date(prev.getFullYear(), prev.getMonth() + delta, 1) : prev));
  };
  const todayKey = dayKeyOfDate(new Date());

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
                  Foi enviado um email de confirmação para {email}.
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
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 24,
                    background: "#FFFFFF",
                    border: "1px solid #E8E0D2",
                    borderRadius: 14,
                    padding: 24,
                  }}
                >
                  {/* Calendário mensal */}
                  <div style={{ flex: "1 1 300px", minWidth: 280 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <button
                        onClick={() => canGoPrev && shiftMonth(-1)}
                        disabled={!canGoPrev}
                        aria-label="Mês anterior"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E0D2",
                          background: "#FFFFFF", cursor: canGoPrev ? "pointer" : "default",
                          opacity: canGoPrev ? 1 : 0.35, color: "#22303A",
                        }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span style={{ fontWeight: 600, fontSize: 15, textTransform: "capitalize", color: "#1A2B3C" }}>
                        {viewMonth ? monthLabel(viewMonth) : ""}
                      </span>
                      <button
                        onClick={() => canGoNext && shiftMonth(1)}
                        disabled={!canGoNext}
                        aria-label="Mês seguinte"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E0D2",
                          background: "#FFFFFF", cursor: canGoNext ? "pointer" : "default",
                          opacity: canGoNext ? 1 : 0.35, color: "#22303A",
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                      {WEEKDAYS.map((w) => (
                        <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#8A968F", padding: "4px 0" }}>
                          {w}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {viewMonth &&
                        buildMonthMatrix(viewMonth.getFullYear(), viewMonth.getMonth()).map((cell, i) => {
                          if (!cell) return <div key={`e-${i}`} />;
                          const key = dayKeyOfDate(cell);
                          const hasSlots = availableDayKeys.has(key);
                          const isSelected = key === selectedDay;
                          const isToday = key === todayKey;
                          return (
                            <button
                              key={key}
                              onClick={() => hasSlots && setSelectedDay(key)}
                              disabled={!hasSlots}
                              style={{
                                aspectRatio: "1 / 1",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                borderRadius: 10,
                                border: isToday && !isSelected ? "1px solid #3B6E8F" : "1px solid transparent",
                                background: isSelected ? "#3B6E8F" : hasSlots ? "#EAF1F5" : "transparent",
                                color: isSelected ? "#FFFFFF" : hasSlots ? "#22303A" : "#C9BFAE",
                                fontSize: 14,
                                fontWeight: hasSlots ? 600 : 400,
                                cursor: hasSlots ? "pointer" : "default",
                              }}
                            >
                              {cell.getDate()}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Horas do dia selecionado */}
                  <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#3B6E8F" }}>
                      <Calendar size={16} />
                      <span style={{ fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>
                        {selectedDay ? formatDayLabel(`${selectedDay}T00:00:00`) : "Escolha um dia"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                      {(selectedDay ? slotsByDayKey[selectedDay] || [] : []).map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "12px 16px", borderRadius: 10, border: "1px solid #3B6E8F",
                            background: "#FFFFFF", color: "#3B6E8F", fontSize: 15, fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Clock size={14} />
                          {formatTimeLabel(slot.start_time)}
                        </button>
                      ))}
                      {selectedDay && (slotsByDayKey[selectedDay] || []).length === 0 && (
                        <p style={{ color: "#8A968F", fontSize: 14, margin: 0 }}>Sem horários neste dia.</p>
                      )}
                    </div>
                  </div>
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
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#FFFFFF", color: "#22303A" }}
                  />
                  <input
                    type="email"
                    placeholder="O seu email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#FFFFFF", color: "#22303A" }}
                  />
                  <input
                    placeholder="O seu telefone (opcional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#FFFFFF", color: "#22303A" }}
                  />

                  {(data.questions || []).map((q) => {
                    const inputStyle = { padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E0D2", fontSize: 14, background: "#FFFFFF", color: "#22303A", width: "100%" as const };
                    return (
                      <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, color: "#555" }}>{q.label}{q.required ? " *" : ""}</label>
                        {q.field_type === "textarea" ? (
                          <textarea rows={2} value={answers[q.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} style={inputStyle} />
                        ) : q.field_type === "select" ? (
                          <select value={answers[q.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} style={inputStyle}>
                            <option value="">Selecione…</option>
                            {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type={q.field_type === "number" ? "number" : q.field_type === "phone" ? "tel" : "text"}
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                            style={inputStyle}
                          />
                        )}
                      </div>
                    );
                  })}

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
