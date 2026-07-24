import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type EventType =
  | "burp"
  | "water"
  | "meal"
  | "activity"
  | "symptom"
  | "medicine"
  | "sleep"
  | "note";

type DailyEvent = {
  id: string;
  event_type: EventType;
  occurred_at: string;
  entered_at: string;
  count: number;
  title: string | null;
  note: string | null;
  details: Record<string, unknown>;
};

type DaySummary = {
  date: string;
  total_burps: number;
  total_events: number;
  events: DailyEvent[];
};

type Insights = {
  date: string;
  burps_by_hour: { hour: number; count: number }[];
  water_burp: {
    window_minutes: number;
    water_events: number;
    total_burps_after: number;
    avg_burps_after: number;
  };
  trend_7d: { date: string; burps: number; symptoms: number }[];
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TZ = "Asia/Kolkata";
const PC_KEY = "refluxcare_passcode";

function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const pc = localStorage.getItem(PC_KEY) ?? "";
  return pc ? { ...base, "X-Passcode": pc } : base;
}

const labels: Record<EventType, string> = {
  burp: "Burp",
  water: "Water",
  meal: "Meal",
  activity: "Activity",
  symptom: "Symptom",
  medicine: "Medicine",
  sleep: "Sleep",
  note: "Note",
};

const SYMPTOMS = [
  "Heartburn",
  "Regurgitation",
  "Bloating",
  "Chest discomfort",
  "Throat irritation",
  "Nausea",
];
const MEAL_TAGS = ["Spicy", "Oily / fried", "Caffeinated", "Carbonated"];
const FACES = ["😌", "😌", "🙂", "😐", "😐", "😕", "😣", "😣", "😖", "😫", "😩"];
const SEV_WORDS = [
  "None",
  "Very mild",
  "Mild",
  "Noticeable",
  "Noticeable",
  "Moderate",
  "Strong",
  "Strong",
  "Severe",
  "Severe",
  "Worst",
];

function localDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekday(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
  })
    .format(new Date())
    .toUpperCase();
}

function displayTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

function sevColor(v: number): string {
  if (v <= 2) return "var(--calm)";
  if (v <= 5) return "var(--warn)";
  if (v <= 7) return "var(--serious)";
  return "var(--critical)";
}

function Ring({
  value,
  goal,
  color,
  label,
  display,
}: {
  value: number;
  goal: number;
  color: string;
  label: string;
  display?: string;
}) {
  const C = 2 * Math.PI * 32;
  const pct = Math.min(value / goal, 1);
  return (
    <div className="ring-card">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="ring-track" cx="40" cy="40" r="32" />
        <circle
          className="ring-val"
          cx="40"
          cy="40"
          r="32"
          stroke={color}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
        />
        <text className="ring-num" x="40" y="46" textAnchor="middle">
          {display ?? value}
        </text>
      </svg>
      <p dangerouslySetInnerHTML={{ __html: label }} />
    </div>
  );
}

export default function App() {
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  const [sheetKind, setSheetKind] = useState<EventType | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState(4);
  const [portion, setPortion] = useState("medium");
  const [mealTags, setMealTags] = useState<string[]>([]);

  const [pulseKey, setPulseKey] = useState(0);
  const [newestId, setNewestId] = useState<string | null>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }

  const refresh = useCallback(async () => {
    const day = localDate();
    try {
      const [dayRes, insRes] = await Promise.all([
        fetch(`${API_URL}/days/${day}?tz=${encodeURIComponent(TZ)}`, {
          headers: authHeaders(),
        }),
        fetch(`${API_URL}/insights/${day}?tz=${encodeURIComponent(TZ)}`, {
          headers: authHeaders(),
        }),
      ]);
      if (dayRes.status === 401) {
        setLocked(true);
        return;
      }
      if (!dayRes.ok) throw new Error("Could not load today's entries.");
      setLocked(false);
      setSummary(await dayRes.json());
      if (insRes.ok) setInsights(await insRes.json());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Something went wrong.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveEvent(payload: {
    event_type: EventType;
    occurred_at: string;
    count?: number;
    title?: string;
    note?: string;
    details?: Record<string, unknown>;
  }): Promise<DailyEvent> {
    const response = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      setLocked(true);
      throw new Error("Please unlock the app and try again.");
    }
    if (!response.ok) throw new Error("The entry was not saved. Please retry.");
    const created: DailyEvent = await response.json();
    await refresh();
    return created;
  }

  async function addBurp() {
    if (busy) return;
    setBusy(true);
    setPulseKey((k) => k + 1);
    try {
      const created = await saveEvent({
        event_type: "burp",
        occurred_at: new Date().toISOString(),
        count: 1,
      });
      setNewestId(created.id);
      showToast(`Burp saved · ${displayTime(created.occurred_at)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function addWater() {
    if (busy) return;
    setBusy(true);
    try {
      const created = await saveEvent({
        event_type: "water",
        occurred_at: new Date().toISOString(),
        count: 1,
        title: "Water — a glass",
      });
      setNewestId(created.id);
      showToast("Water logged · watching for burps after");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    window.setTimeout(() => setRefreshing(false), 400);
    showToast("Refreshed");
  }

  async function deleteEvent(id: string) {
    if (!window.confirm("Remove this entry? You can log it again correctly.")) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/events/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setLocked(true);
        return;
      }
      if (!res.ok && res.status !== 204) {
        throw new Error("Could not remove the entry. Please retry.");
      }
      await refresh();
      showToast("Entry removed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    }
  }

  async function undoLastBurp() {
    const lastBurp = summary?.events.find((e) => e.event_type === "burp");
    if (!lastBurp) return;
    try {
      const res = await fetch(`${API_URL}/events/${lastBurp.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setLocked(true);
        return;
      }
      if (!res.ok && res.status !== 204) throw new Error("Could not undo.");
      await refresh();
      showToast("Removed last burp");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    }
  }

  function openSheet(kind: EventType) {
    if (sheetKind === kind) {
      setSheetKind(null);
      return;
    }
    setSheetKind(kind);
    setTitle("");
    setNote("");
    setSeverity(4);
    setPortion("medium");
    setMealTags([]);
  }

  async function submitSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheetKind) return;
    const details: Record<string, unknown> = {};
    if (sheetKind === "symptom") details.severity = severity;
    if (sheetKind === "meal") {
      details.portion = portion;
      if (mealTags.length) details.tags = mealTags;
    }
    setBusy(true);
    try {
      const created = await saveEvent({
        event_type: sheetKind,
        occurred_at: new Date().toISOString(),
        title: title.trim() || labels[sheetKind],
        note: note.trim() || undefined,
        details,
      });
      setNewestId(created.id);
      setSheetKind(null);
      showToast(`${labels[sheetKind]} saved to today`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const events = summary?.events ?? [];
  const totalBurps = summary?.total_burps ?? 0;
  const waterCount = useMemo(
    () =>
      events
        .filter((e) => e.event_type === "water")
        .reduce((sum, e) => sum + e.count, 0),
    [events],
  );
  const mealCount = useMemo(
    () => events.filter((e) => e.event_type === "meal").length,
    [events],
  );

  const wb = insights?.water_burp;

  if (locked) {
    return (
      <UnlockScreen
        onUnlock={(pc) => {
          localStorage.setItem(PC_KEY, pc);
          setLocked(false);
          setError("");
          void refresh();
        }}
      />
    );
  }

  return (
    <main>
      <header>
        <div className="brand">
          <div className="logo">🌿</div>
          <div>
            <h1>RefluxCare</h1>
            <p className="eyebrow">{weekday()} · TODAY</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn ${refreshing ? "spin" : ""}`}
            onClick={handleRefresh}
            aria-label="Refresh"
            title="Refresh"
          >
            ↻
          </button>
          <div className="avatar" aria-label="Personal profile">
            P
          </div>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* HERO */}
      <section className="hero">
        <div className="hero-body">
          <p className="hero-label">Burps today</p>
          <strong>{totalBurps}</strong>
          <span>Every tap is saved with its exact time</span>
          {events.some((e) => e.event_type === "burp") && (
            <button className="undo" onClick={undoLastBurp}>
              ↩ Undo last
            </button>
          )}
        </div>
        <div className="burp-wrap">
          <span key={pulseKey} className="pulse" />
          <button
            className="burp-button"
            onClick={addBurp}
            disabled={busy}
            aria-label="Record one burp"
          >
            <b>+1</b>
            BURP
          </button>
        </div>
      </section>

      {/* RINGS */}
      <div className="rings">
        <Ring value={totalBurps} goal={15} color="var(--warn)" label="Burps<br>logged" />
        <Ring value={waterCount} goal={8} color="var(--water)" label="Glasses<br>of water" />
        <Ring value={mealCount} goal={4} color="var(--green-500)" label="Meals<br>tracked" />
      </div>

      {/* QUICK LOG */}
      <section>
        <div className="section-heading">
          <h2>Quick log</h2>
          <span>Tap to add</span>
        </div>
        <div className="quick-grid">
          {(["meal", "activity", "symptom", "medicine"] as EventType[]).map(
            (type) => (
              <button
                key={type}
                onClick={() => openSheet(type)}
                className={`chip ${sheetKind === type ? "active" : ""}`}
              >
                <i className={`i-${type}`}>
                  {type === "meal"
                    ? "🍽️"
                    : type === "activity"
                      ? "🚶"
                      : type === "symptom"
                        ? "💢"
                        : "💊"}
                </i>
                {labels[type]}
              </button>
            ),
          )}
        </div>

        <button className="water-btn" onClick={addWater} disabled={busy}>
          <span className="water-left">
            <i>💧</i> Had water — a glass
          </span>
          <span className="water-count">
            <b>{waterCount}</b> today
          </span>
        </button>

        {sheetKind && (
          <form className="sheet-inner" onSubmit={submitSheet}>
            <h3>Log a {labels[sheetKind].toLowerCase()}</h3>

            {sheetKind === "symptom" && (
              <>
                <p className="lead">How strong is it right now?</p>
                <div className="sev-face">{FACES[severity]}</div>
                <div className="sev-label" style={{ color: sevColor(severity) }}>
                  {severity} · {SEV_WORDS[severity]}
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="slider"
                  style={{
                    background: `linear-gradient(90deg, ${sevColor(severity)} ${severity * 10}%, var(--chart-track) ${severity * 10}%)`,
                  }}
                />
                <div className="scale-row">
                  <span>None</span>
                  <span>Mild</span>
                  <span>Strong</span>
                  <span>Severe</span>
                </div>
                <div className="tags">
                  {SYMPTOMS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={`tag ${title === s ? "on" : ""}`}
                      onClick={() => setTitle(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {sheetKind === "meal" && (
              <>
                <label>
                  Portion size
                  <div className="tags">
                    {["small", "medium", "large"].map((p) => (
                      <button
                        type="button"
                        key={p}
                        className={`tag ${portion === p ? "on" : ""}`}
                        onClick={() => setPortion(p)}
                      >
                        {p[0].toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </label>
                <div className="tags">
                  {MEAL_TAGS.map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={`tag ${mealTags.includes(t) ? "on" : ""}`}
                      onClick={() =>
                        setMealTags((prev) =>
                          prev.includes(t)
                            ? prev.filter((x) => x !== t)
                            : [...prev, t],
                        )
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label>
              Short description
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={
                  sheetKind === "meal"
                    ? "e.g. Idli and sambar"
                    : sheetKind === "symptom"
                      ? "e.g. Heartburn"
                      : "Short label"
                }
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Posture, timing, anything you noticed…"
              />
            </label>
            <button className="save-button" disabled={busy}>
              Save to today
            </button>
          </form>
        )}
      </section>

      {/* INSIGHTS */}
      <section>
        <div className="section-heading">
          <h2>Insights</h2>
          <span>Patterns, not diagnosis</span>
        </div>

        <div className="insight insight-water">
          <span className="ico">💧</span>
          <p>
            {wb && wb.water_events > 0 ? (
              <>
                <b>
                  {wb.avg_burps_after} burp
                  {wb.avg_burps_after === 1 ? "" : "s"} on average
                </b>{" "}
                within {wb.window_minutes} min of a glass of water, from{" "}
                {wb.water_events} glass{wb.water_events === 1 ? "" : "es"}{" "}
                tracked today.
                <small>
                  An observed association. Sipping slowly may be worth trying.
                </small>
              </>
            ) : (
              <>
                <b>Log water and burps</b> to reveal this pattern.
                <small>
                  RefluxCare will measure burps in the {wb?.window_minutes ?? 15}{" "}
                  minutes after each glass.
                </small>
              </>
            )}
          </p>
        </div>

        {/* Burps by hour */}
        <div className="card">
          <h3>Burps by hour</h3>
          <p className="cap">Today · hover a bar for the exact count</p>
          <BurpsByHour
            data={insights?.burps_by_hour ?? []}
            hoverHour={hoverHour}
            setHoverHour={setHoverHour}
          />
        </div>

        {/* 7-day trend */}
        <div className="card">
          <h3>Burps per day — last 7 days</h3>
          <p className="cap">Lower is calmer</p>
          <TrendSpark data={insights?.trend_7d ?? []} />
        </div>
      </section>

      {/* TIMELINE */}
      <section className="timeline">
        <div className="section-heading">
          <h2>Today's timeline</h2>
          <span>{summary?.total_events ?? 0} entries</span>
        </div>
        {!events.length && (
          <div className="empty">
            <strong>Your day starts here</strong>
            <p>Log water, a meal, a symptom, or tap the burp counter.</p>
          </div>
        )}
        {events.map((event) => (
          <article
            className={`event ${event.event_type} ${event.id === newestId ? "ev-enter" : ""}`}
            key={event.id}
          >
            <time>{displayTime(event.occurred_at)}</time>
            <div className="event-mark" />
            <div className="event-body">
              <strong>
                {event.title || labels[event.event_type]}
                {event.event_type === "burp" && event.count > 1
                  ? ` × ${event.count}`
                  : ""}
              </strong>
              {event.note && <p>{event.note}</p>}
            </div>
            <button
              className="event-del"
              onClick={() => deleteEvent(event.id)}
              aria-label="Remove this entry"
              title="Remove this entry"
            >
              ✕
            </button>
          </article>
        ))}
      </section>

      <p className="disclaimer">
        RefluxCare helps you notice patterns to discuss with your doctor.
        <br />
        It does not diagnose conditions or replace medical advice.
      </p>

      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
    </main>
  );
}

function UnlockScreen({ onUnlock }: { onUnlock: (pc: string) => void }) {
  const [value, setValue] = useState("");
  const triedBefore = (localStorage.getItem(PC_KEY) ?? "") !== "";
  return (
    <main className="lock">
      <div className="lock-card">
        <div className="logo">🌿</div>
        <h1>RefluxCare</h1>
        <p className="lock-msg">
          {triedBefore
            ? "That passcode didn't work. Please try again."
            : "Enter your passcode to open your private tracker."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onUnlock(value.trim());
          }}
        >
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Passcode"
            autoFocus
            aria-label="Passcode"
          />
          <button className="save-button" type="submit">
            Unlock
          </button>
        </form>
        <p className="lock-foot">Your health data stays private to you.</p>
      </div>
    </main>
  );
}

function BurpsByHour({
  data,
  hoverHour,
  setHoverHour,
}: {
  data: { hour: number; count: number }[];
  hoverHour: number | null;
  setHoverHour: (h: number | null) => void;
}) {
  const START = 6;
  const END = 23;
  const byHour = new Map(data.map((d) => [d.hour, d.count]));
  const hours = Array.from({ length: END - START + 1 }, (_, i) => START + i);
  const values = hours.map((h) => byHour.get(h) ?? 0);
  const max = Math.max(4, ...values);
  const hovered = hoverHour == null ? null : byHour.get(hoverHour) ?? 0;

  function label12(h: number): string {
    const hour = ((h + 11) % 12) + 1;
    return `${hour} ${h < 12 ? "AM" : "PM"}`;
  }

  return (
    <>
      <div className="bars">
        {hours.map((h) => {
          const v = byHour.get(h) ?? 0;
          return (
            <div
              key={h}
              className={`bar ${v === max && v > 0 ? "peak" : ""}`}
              onPointerEnter={() => setHoverHour(h)}
              onPointerLeave={() => setHoverHour(null)}
            >
              <span style={{ height: `${(v / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="chart-foot">
        {hoverHour != null ? (
          <span className="chart-read">
            {label12(hoverHour)} ·{" "}
            <b>
              {hovered} burp{hovered === 1 ? "" : "s"}
            </b>
          </span>
        ) : (
          <div className="xaxis">
            {hours.map((h) => (
              <span key={h}>{h % 3 === 0 ? ((h + 11) % 12) + 1 : ""}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TrendSpark({ data }: { data: { date: string; burps: number }[] }) {
  if (data.length < 2) {
    return <p className="cap">Not enough days yet — keep logging.</p>;
  }
  const W = 320;
  const H = 96;
  const pad = 8;
  const max = Math.max(4, ...data.map((d) => d.burps));
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (data.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.burps).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const last = data[data.length - 1];
  const first = data[0];
  const delta = last.burps - first.burps;

  return (
    <>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart-fill)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--chart-fill)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendfill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--chart-fill)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={x(data.length - 1)}
          cy={y(last.burps)}
          r={4.5}
          fill="var(--chart-fill)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
      </svg>
      <div className="legend">
        <span className="dot" />
        {delta === 0
          ? "Steady vs. 7 days ago"
          : delta < 0
            ? `Down ${Math.abs(delta)} vs. 7 days ago — calmer`
            : `Up ${delta} vs. 7 days ago`}
      </div>
    </>
  );
}
