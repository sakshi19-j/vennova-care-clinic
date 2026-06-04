import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import { queueActions } from "@/lib/queue-store";
import {
  MessageCircle, Settings, X, Calendar, Send,
  Edit3, Save, RefreshCw, Link as LinkIcon, AlertCircle, CheckCircle2,
  Sparkles, Inbox, Clock,
} from "lucide-react";

export const Route = createFileRoute("/reception/followups")({
  component: FollowupsPage,
});

// ─────────────────────────── Model ───────────────────────────
type Stage = 3 | 7 | 15;
type FollowupRow = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  last_visit_date: string;          // ISO date "YYYY-MM-DD"
  stage: Stage;                     // active stage
  last_attempt_at?: string;         // ISO date when reminder for current stage was sent
  responded: boolean;
  responded_at?: string;            // ISO timestamp — when backend detected reply
  calendly_sent: boolean;
  calendly_sent_at?: string;        // ISO timestamp — when system auto-sent the link
  booked: boolean;                  // true => appointment created → row hidden
  exhausted: boolean;               // sent 15-day and still no engagement → archive
};

// ── Default WhatsApp templates (editable in Settings) ──
const DEFAULT_TEMPLATES: Record<Stage | "CALENDLY", string> = {
  3:  "Hello {name} 🙏\n\nIt's been 3 days since your visit to *Vedic Homeopathic Clinic*. We hope you're feeling better.\n\nReply *YES* if all is well, or *BOOK* and we'll share open slots with you.\n\nTake care 🌿",
  7:  "Hello {name} 🙏\n\nA gentle 7-day check-in from *Vedic Homeopathic Clinic*. We haven't heard back from you.\n\nIf you'd like a follow-up consultation, just reply *BOOK* and we'll send you available slots.\n\nWarm regards 🌿",
  15: "Hello {name} 🙏\n\n15 days have passed since your last visit to *Vedic Homeopathic Clinic*. Your recovery matters to us.\n\nPlease reply *BOOK* to schedule a follow-up — our doctors are available this week.\n\nStay well 🌿",
  CALENDLY:
    "Hello {name} 🙏\n\nThank you for reaching back! Please pick a slot that works for you:\n\n📅 {calendly_url}\n\nOnce booked, your appointment will be confirmed automatically. See you soon 🌿",
};

const CALENDLY_URL_DEFAULT = "https://calendly.com/vedic-homeopathic/follow-up";

// ── Seed data (demo). In production this would come from a server. ──
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const SEED: FollowupRow[] = [
  { id: "fu-1", patient_id: "p1", patient_name: "Anjali Mehta",  patient_phone: "+91 98200 11122", last_visit_date: daysAgo(3),  stage: 3,  responded: false, calendly_sent: false, booked: false, exhausted: false },
  { id: "fu-2", patient_id: "p4", patient_name: "Mahesh Iyer",   patient_phone: "+91 98765 44315", last_visit_date: daysAgo(7),  stage: 7,  responded: false, calendly_sent: false, booked: false, exhausted: false, last_attempt_at: daysAgo(4) },
  { id: "fu-3", patient_id: "p6", patient_name: "Sandeep Shah",  patient_phone: "+91 98123 66517", last_visit_date: daysAgo(15), stage: 15, responded: false, calendly_sent: false, booked: false, exhausted: false, last_attempt_at: daysAgo(8) },
  { id: "fu-4", patient_id: "p5", patient_name: "Neha Gupta",    patient_phone: "+91 99887 55416", last_visit_date: daysAgo(3),  stage: 3,  responded: false, calendly_sent: false, booked: false, exhausted: false },
  { id: "fu-5", patient_id: "p9", patient_name: "Sunita Desai",  patient_phone: "+91 98345 88823", last_visit_date: daysAgo(7),  stage: 7,  responded: false, calendly_sent: false, booked: false, exhausted: false, last_attempt_at: daysAgo(4) },
  { id: "fu-6", patient_id: "p7", patient_name: "Kavita Rao",    patient_phone: "+91 98801 77711", last_visit_date: daysAgo(3),  stage: 3,  responded: false, calendly_sent: false, booked: false, exhausted: false, last_attempt_at: todayISO() },
];

// ─────────────────────────── Helpers ───────────────────────────
function personalise(template: string, name: string, calendlyUrl?: string) {
  return template
    .replace(/\{name\}/g, name.split(" ")[0])
    .replace(/\{calendly_url\}/g, calendlyUrl ?? CALENDLY_URL_DEFAULT);
}

function isDueToday(row: FollowupRow): boolean {
  if (row.booked || row.exhausted || row.responded) return false;
  if (row.last_attempt_at === todayISO()) return false;
  const due = new Date(row.last_visit_date);
  due.setDate(due.getDate() + row.stage);
  return new Date(todayISO()) >= due;
}

function daysSince(date?: string): number | null {
  if (!date) return null;
  const a = new Date(todayISO()).getTime();
  const b = new Date(date).getTime();
  return Math.max(0, Math.round((a - b) / 86_400_000));
}

function lastTouchLabel(row: FollowupRow): string {
  if (!row.last_attempt_at) return "No outreach yet";
  const d = daysSince(row.last_attempt_at)!;
  if (d === 0) return "Reached today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function relTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ─────────────────────────── Page ───────────────────────────
type Tab = "today" | "responded" | "booking";

function FollowupsPage() {
  const [rows, setRows] = useState<FollowupRow[]>(SEED);
  const [templates, setTemplates] = useState({ ...DEFAULT_TEMPLATES });
  const [calendlyUrl, setCalendlyUrl] = useState(CALENDLY_URL_DEFAULT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [, force] = useState(0);

  const dueToday    = useMemo(() => rows.filter(isDueToday), [rows]);
  const responded   = useMemo(
    () => rows.filter((r) => r.responded && !r.booked && !r.exhausted)
              .sort((a, b) => (b.responded_at ?? "").localeCompare(a.responded_at ?? "")),
    [rows],
  );
  const awaitingBooking = useMemo(
    () => responded.filter((r) => r.calendly_sent && !r.booked),
    [responded],
  );

  const sentToday = useMemo(
    () => rows.filter((r) => r.last_attempt_at === todayISO()).length,
    [rows],
  );
  const totalToReach = dueToday.length + sentToday;
  const progressPct  = totalToReach === 0 ? 100 : Math.round((sentToday / totalToReach) * 100);

  // ── Refresh "x seconds ago" labels every 15s ──
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── 🤖 Autonomous backend poller ──
  // In production this would be a server cron/webhook listening to WhatsApp Business
  // delivery + reply events. Here we simulate it: any patient who's been messaged but
  // hasn't responded has a small per-tick chance of replying. When a reply is detected,
  // we *automatically* dispatch the Calendly slots message — no receptionist action.
  const lastTickRef = useRef<number>(Date.now());
  useEffect(() => {
    const POLL_MS = 6_000;
    const REPLY_CHANCE_PER_TICK = 0.18; // demo-friendly

    const tick = () => {
      lastTickRef.current = Date.now();
      setRows((rs) => {
        let changed = false;
        const next = rs.map((r) => {
          if (r.booked || r.exhausted || r.responded) return r;
          if (!r.last_attempt_at) return r;
          if (Math.random() > REPLY_CHANCE_PER_TICK) return r;

          // Backend detected a reply → auto-send Calendly link.
          const nowIso = new Date().toISOString();
          changed = true;
          toast.success(`${r.patient_name.split(" ")[0]} replied — Calendly link auto-sent`, {
            description: "Moved to Responded queue",
            icon: <Sparkles className="size-4" />,
          });
          return {
            ...r,
            responded: true,
            responded_at: nowIso,
            calendly_sent: true,
            calendly_sent_at: nowIso,
          };
        });
        return changed ? next : rs;
      });
    };

    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Send the stage reminder ──
  const sendStageReminder = (row: FollowupRow) => {
    const tmpl = templates[row.stage] ?? DEFAULT_TEMPLATES[row.stage];
    const msg = personalise(tmpl, row.patient_name);
    const phone = row.patient_phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    setRows((rs) =>
      rs.map((r) => (r.id === row.id ? { ...r, last_attempt_at: todayISO() } : r)),
    );
    toast.success(`${row.stage}-day reminder sent to ${row.patient_name.split(" ")[0]}`);
  };

  // ── Manual re-send of Calendly (in case patient lost the link) ──
  const resendCalendly = (row: FollowupRow) => {
    const msg = personalise(templates.CALENDLY, row.patient_name, calendlyUrl);
    const phone = row.patient_phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    setRows((rs) =>
      rs.map((r) => (r.id === row.id ? { ...r, calendly_sent_at: new Date().toISOString() } : r)),
    );
    toast.success("Calendly link re-sent");
  };

  // ── Confirm booking (called once Calendly webhook fires; manual fallback here) ──
  const confirmBooking = (row: FollowupRow, date: string, time: string) => {
    const scheduled_at = new Date(`${date}T${time}`).toISOString();
    queueActions.addAppointment({
      patient_id: row.patient_id,
      patient_name: row.patient_name,
      patient_phone: row.patient_phone,
      scheduled_at,
      visit_type: "HOMEOPATHY",
      status: "CONFIRMED",
      chief_complaint: "Follow-up (via Calendly)",
      duration_mins: 30,
    });
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, booked: true } : r)));
    toast.success(`Appointment booked for ${row.patient_name.split(" ")[0]} on ${date} at ${time}`);
  };

  const advanceStage = (row: FollowupRow) => {
    const next: Stage | null = row.stage === 3 ? 7 : row.stage === 7 ? 15 : null;
    if (!next) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, exhausted: true } : r)));
      toast(`${row.patient_name.split(" ")[0]} archived — 15-day reminder exhausted`);
      return;
    }
    setRows((rs) =>
      rs.map((r) => (r.id === row.id ? { ...r, stage: next, last_attempt_at: undefined } : r)),
    );
    toast(`Advanced ${row.patient_name.split(" ")[0]} → ${next}-day stage`);
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* ── Left ── */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {/* Action header */}
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-card border-primary/20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-primary/80 font-medium">Today's outreach</div>
              <div className="font-display text-4xl mt-1">
                {dueToday.length} <span className="text-muted-foreground text-2xl">to reach out</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {sentToday} done · {dueToday.length} pending · {totalToReach} total today
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 px-3 text-[11px] font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-replies monitored
              </span>
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-9 px-4 rounded-full border border-border bg-card text-xs font-medium inline-flex items-center gap-1.5 hover:bg-muted"
              >
                <Settings className="size-3.5" /> Settings
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Daily progress</span>
              <span className="tabular-nums font-medium">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 w-fit">
          <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<Send className="size-3.5" />} label="Reach out today" count={dueToday.length} />
          <TabButton active={tab === "responded"} onClick={() => setTab("responded")} icon={<Inbox className="size-3.5" />} label="Responded" count={responded.length} highlight />
          <TabButton active={tab === "booking"} onClick={() => setTab("booking")} icon={<Clock className="size-3.5" />} label="Awaiting booking" count={awaitingBooking.length} />
        </div>

        {/* ── Tab: Today ── */}
        {tab === "today" && (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b clinic-divider">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reach out today</div>
              <div className="font-display text-lg mt-0.5">{dueToday.length} patients</div>
            </div>

            {dueToday.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-8 text-emerald-500/60" />}
                title="Nothing left for today."
                hint="Replies are tracked automatically — check the Responded tab as they come in."
              />
            ) : (
              <ul className="divide-y clinic-divider">
                {dueToday.map((row) => (
                  <OutreachRow
                    key={row.id}
                    row={row}
                    onSendReminder={() => sendStageReminder(row)}
                    onAdvance={() => advanceStage(row)}
                  />
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ── Tab: Responded (auto-handled) ── */}
        {tab === "responded" && (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b clinic-divider flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-700 inline-flex items-center gap-1.5">
                  <Sparkles className="size-3" /> Auto-handled by the system
                </div>
                <div className="font-display text-lg mt-0.5">{responded.length} patients responded</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Calendly slots were sent automatically. You'll see the appointment appear once they book.
                </div>
              </div>
            </div>

            {responded.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-8 text-muted-foreground/50" />}
                title="No replies yet."
                hint="The system is watching for WhatsApp replies in the background."
              />
            ) : (
              <ul className="divide-y clinic-divider">
                {responded.map((row) => (
                  <RespondedRow
                    key={row.id}
                    row={row}
                    calendlyUrl={calendlyUrl}
                    onResend={() => resendCalendly(row)}
                    onConfirmBooking={(d, t) => confirmBooking(row, d, t)}
                  />
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ── Tab: Awaiting booking ── */}
        {tab === "booking" && (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b clinic-divider">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Awaiting Calendly booking</div>
              <div className="font-display text-lg mt-0.5">{awaitingBooking.length} patients</div>
            </div>

            {awaitingBooking.length === 0 ? (
              <EmptyState
                icon={<Clock className="size-8 text-muted-foreground/50" />}
                title="Nobody waiting."
                hint="Patients move here after Calendly is sent and stay until they pick a slot."
              />
            ) : (
              <ul className="divide-y clinic-divider">
                {awaitingBooking.map((row) => (
                  <RespondedRow
                    key={row.id}
                    row={row}
                    calendlyUrl={calendlyUrl}
                    onResend={() => resendCalendly(row)}
                    onConfirmBooking={(d, t) => confirmBooking(row, d, t)}
                    compact
                  />
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* ── Right: pipeline summary ── */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <Card>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pipeline</div>
          <div className="font-display text-lg mt-0.5">Follow-up stages</div>
          <div className="mt-3 space-y-2">
            <PipelineRow label="3-day" count={rows.filter((r) => !r.booked && !r.exhausted && !r.responded && r.stage === 3).length} />
            <PipelineRow label="7-day" count={rows.filter((r) => !r.booked && !r.exhausted && !r.responded && r.stage === 7).length} />
            <PipelineRow label="15-day" count={rows.filter((r) => !r.booked && !r.exhausted && !r.responded && r.stage === 15).length} />
            <div className="border-t clinic-divider pt-2 mt-2 space-y-2">
              <PipelineRow label="Responded (auto)" count={responded.length} accent="success" />
              <PipelineRow label="Booked" count={rows.filter((r) => r.booked).length} accent="success" />
              <PipelineRow label="Archived" count={rows.filter((r) => r.exhausted).length} accent="muted" />
            </div>
          </div>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <div className="text-xs text-foreground/80 leading-relaxed">
            <div className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold mb-1">
              <Sparkles className="size-3.5" /> Autonomous workflow
            </div>
            The system watches for WhatsApp replies in the background. The moment a patient
            responds, the Calendly link is sent automatically and they move to the
            <strong> Responded</strong> tab — no manual check-in needed.
          </div>
        </Card>
      </div>

      {settingsOpen && (
        <SettingsPanel
          templates={templates}
          calendlyUrl={calendlyUrl}
          onClose={() => setSettingsOpen(false)}
          onSave={(t, url) => {
            setTemplates(t);
            setCalendlyUrl(url);
            setSettingsOpen(false);
            toast.success("Follow-up settings saved");
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Tabs ───────────────────────────
function TabButton({
  active, onClick, icon, label, count, highlight,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative h-9 px-4 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
        active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span className={`tabular-nums ${active ? "text-foreground/70" : ""}`}>· {count}</span>
      {highlight && count > 0 && !active && (
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
      )}
    </button>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-2 w-fit">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{hint}</div>
    </div>
  );
}

// ─────────────────────────── Rows ───────────────────────────
function OutreachRow({
  row, onSendReminder, onAdvance,
}: {
  row: FollowupRow; onSendReminder: () => void; onAdvance: () => void;
}) {
  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar name={row.patient_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{row.patient_name}</span>
            <Tag className="bg-card border-border text-foreground/70">{row.stage}-day stage</Tag>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>Last touch: <strong className={row.last_attempt_at ? "text-foreground" : "text-amber-700"}>{lastTouchLabel(row)}</strong></span>
            <span>·</span>
            <span>{row.patient_phone}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onSendReminder}
            className="h-9 px-4 rounded-full bg-[#25D366] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#1ebe5d]"
          >
            <MessageCircle className="size-3.5" /> Send {row.stage}-day reminder
          </button>
          {row.last_attempt_at && row.stage !== 15 && (
            <button
              onClick={onAdvance}
              title="Patient didn't engage — move to next stage"
              className="size-9 rounded-full border border-border hover:bg-muted grid place-items-center"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function RespondedRow({
  row, calendlyUrl, onResend, onConfirmBooking, compact,
}: {
  row: FollowupRow;
  calendlyUrl: string;
  onResend: () => void;
  onConfirmBooking: (date: string, time: string) => void;
  compact?: boolean;
}) {
  const [bookDate, setBookDate] = useState(todayISO());
  const [bookTime, setBookTime] = useState("11:00");

  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar name={row.patient_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{row.patient_name}</span>
            <Tag className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 inline-flex items-center gap-1">
              <Sparkles className="size-3" /> Replied {relTime(row.responded_at)}
            </Tag>
            {row.calendly_sent && (
              <Tag className="bg-blue-500/15 text-blue-700 border-blue-500/30 inline-flex items-center gap-1">
                <LinkIcon className="size-3" /> Calendly auto-sent {relTime(row.calendly_sent_at)}
              </Tag>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{row.patient_phone}</span>
            <span>·</span>
            <span className="truncate">
              <a href={calendlyUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{calendlyUrl}</a>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onResend}
            title="Re-send Calendly link"
            className="h-9 px-3 rounded-full border border-border text-xs hover:bg-muted inline-flex items-center gap-1.5"
          >
            <Send className="size-3.5" /> Re-send
          </button>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 ml-12 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <div className="text-xs text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <AlertCircle className="size-3.5" /> Booking auto-confirms when the patient picks a Calendly slot. Use this to log it manually if needed.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={bookDate} min={todayISO()} onChange={(e) => setBookDate(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2 text-xs" />
            <input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2 text-xs" />
            <button onClick={() => onConfirmBooking(bookDate, bookTime)} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:bg-primary/90">
              <Calendar className="size-3.5" /> Confirm booking
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function PipelineRow({ label, count, accent }: { label: string; count: number; accent?: "success" | "muted" }) {
  const color =
    accent === "success" ? "text-emerald-700" :
    accent === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-display text-lg tabular-nums ${color}`}>{count}</span>
    </div>
  );
}

// ─────────────────────────── Settings ───────────────────────────
function SettingsPanel({
  templates, calendlyUrl, onClose, onSave,
}: {
  templates: Record<Stage | "CALENDLY", string>;
  calendlyUrl: string;
  onClose: () => void;
  onSave: (t: Record<Stage | "CALENDLY", string>, url: string) => void;
}) {
  const [draft, setDraft] = useState({ ...templates });
  const [url, setUrl] = useState(calendlyUrl);
  const [editing, setEditing] = useState<Stage | "CALENDLY" | null>(null);

  const reset = (key: Stage | "CALENDLY") => {
    setDraft((d) => ({ ...d, [key]: DEFAULT_TEMPLATES[key] }));
    toast("Reset to default");
  };

  const SECTIONS: Array<{ key: Stage | "CALENDLY"; title: string; hint: string }> = [
    { key: 3,  title: "3-day reminder",  hint: "Sent 3 days after the patient's last visit." },
    { key: 7,  title: "7-day reminder",  hint: "Sent if no engagement after the 3-day message." },
    { key: 15, title: "15-day reminder", hint: "Final reminder — after this, patient is archived." },
    { key: "CALENDLY", title: "Calendly slots message", hint: "Auto-sent the moment the patient replies. Use {calendly_url}." },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto clinic-card p-6 bg-card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
              <Settings className="size-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Follow-up settings</div>
              <h2 className="font-display text-2xl">Customise messages</h2>
            </div>
          </div>
          <button onClick={onClose} className="size-9 rounded-full hover:bg-muted grid place-items-center"><X className="size-4" /></button>
        </div>

        <div className="mb-5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Calendly link</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            placeholder="https://calendly.com/your-handle/follow-up"
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            Auto-sent on every detected reply. Use <code className="bg-muted px-1 rounded">{"{calendly_url}"}</code> in the Calendly template.
          </div>
        </div>

        <div className="space-y-3">
          {SECTIONS.map(({ key, title, hint }) => (
            <div key={String(key)} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => reset(key)} className="size-7 rounded-lg hover:bg-muted grid place-items-center" title="Reset"><RefreshCw className="size-3.5" /></button>
                  <button onClick={() => setEditing(editing === key ? null : key)} className="size-7 rounded-lg hover:bg-muted grid place-items-center" title="Edit">
                    <Edit3 className="size-3.5" />
                  </button>
                </div>
              </div>
              {editing === key ? (
                <textarea
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  rows={6}
                  className="w-full rounded-lg border border-input bg-card p-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              ) : (
                <pre className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 whitespace-pre-wrap font-mono leading-relaxed">{draft[key]}</pre>
              )}
            </div>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground mt-3">
          Placeholders: <code className="bg-muted px-1 rounded">{"{name}"}</code> · <code className="bg-muted px-1 rounded">{"{calendly_url}"}</code>
        </div>

        <div className="flex justify-end gap-2 mt-6 border-t clinic-divider pt-4">
          <button onClick={onClose} className="h-10 px-5 rounded-full border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={() => onSave(draft, url)} className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 hover:bg-primary/90">
            <Save className="size-4" /> Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
