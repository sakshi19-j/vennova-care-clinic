import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import { api, ApiError } from "@/lib/api-client";
import { remindersService } from "@/services/reminders";
import {
  MessageCircle, Send, CheckCircle2, AlertCircle, Clock, CalendarClock,
  Loader2, RefreshCw, Inbox,
} from "lucide-react";

export const Route = createFileRoute("/reception/followups")({
  head: () => ({
    meta: [{ title: "Follow-ups — Vennova Clinic" }],
  }),
  component: FollowupsPage,
});

// ─────────────────────────── Model ───────────────────────────
// Permissive shape — backend may use slightly different field names and may
// embed the joined patient as a nested object.
type Followup = {
  id?: string;
  followup_id?: string;
  reminder_id?: string;
  patient_id?: string;
  patient_name?: string;
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  patient_phone?: string;
  phone?: string;
  phone_mobile?: string;
  mobile?: string;
  patient?: {
    id?: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone?: string;
    phone_mobile?: string;
    mobile?: string;
  };
  visit_id?: string;
  visit_date?: string;
  visit_at?: string;
  visit?: { id?: string; visit_date?: string; created_at?: string; closed_at?: string };
  type?: string;             // FollowUpCreate uses `type`
  followup_type?: string;
  preset?: string;
  due_date?: string;          // YYYY-MM-DD
  due_at?: string;            // ISO timestamp
  scheduled_at?: string;
  status?: string;            // PENDING | SENT | RESPONDED | COMPLETED | MISSED | CANCELLED
  channel?: string;
  sent_at?: string | null;
};

type Bucket = "today" | "upcoming" | "missed" | "completed";

// ─────────────────────────── Helpers ───────────────────────────
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "followups", "reminders"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function rowId(r: Followup): string {
  return String(r.id || r.followup_id || r.reminder_id || "");
}
function rowName(r: Followup): string {
  const direct = r.patient_name || r.full_name || r.patient?.full_name;
  if (direct && direct.trim()) return direct.trim();
  const parts = [
    r.patient?.first_name ?? r.first_name ?? r.patient_first_name,
    r.patient?.middle_name ?? r.middle_name,
    r.patient?.last_name ?? r.last_name ?? r.patient_last_name,
  ].filter(Boolean);
  return parts.join(" ").trim();
}
function rowPhone(r: Followup): string {
  return String(
    r.patient_phone || r.phone || r.phone_mobile || r.mobile ||
    r.patient?.phone || r.patient?.phone_mobile || r.patient?.mobile || "",
  );
}
function rowType(r: Followup): string {
  return String(r.followup_type || r.type || r.preset || "").trim();
}
function rowDueDate(r: Followup): Date | null {
  const raw = r.due_at || r.scheduled_at || r.due_date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function rowVisitDate(r: Followup): Date | null {
  const raw =
    r.visit_date || r.visit_at || r.visit?.visit_date ||
    r.visit?.closed_at || r.visit?.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function rowStatus(r: Followup): string {
  return String(r.status || "PENDING").toUpperCase();
}

function classifyBucket(r: Followup): Bucket {
  const status = rowStatus(r);
  if (status === "COMPLETED" || status === "RESPONDED" || status === "BOOKED") return "completed";
  if (status === "MISSED" || status === "CANCELLED" || status === "ARCHIVED") return "missed";
  const due = rowDueDate(r);
  if (!due) return "upcoming";
  const today = startOfDay(new Date()).getTime();
  const d = startOfDay(due).getTime();
  if (d < today) return "missed";   // past due, never completed
  if (d === today) return "today";
  return "upcoming";
}

function countdownLabel(r: Followup): { text: string; tone: "ok" | "warn" | "danger" | "muted" } {
  const due = rowDueDate(r);
  if (!due) return { text: "—", tone: "muted" };
  const now = new Date();
  const ms = startOfDay(due).getTime() - startOfDay(now).getTime();
  const days = Math.round(ms / 86_400_000);
  if (days < 0) return { text: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "danger" };
  if (days === 0) {
    const hrs = Math.round((due.getTime() - now.getTime()) / 3_600_000);
    if (hrs <= 0) return { text: "Due now", tone: "warn" };
    return { text: `Due in ${hrs}h`, tone: "warn" };
  }
  if (days === 1) return { text: "Due tomorrow", tone: "warn" };
  if (days <= 3) return { text: `In ${days} days`, tone: "ok" };
  return { text: `In ${days} days`, tone: "muted" };
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}

// ─────────────────────────── Page ───────────────────────────
function FollowupsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Bucket>("today");
  const [sending, setSending] = useState<string | null>(null);

  const todayQ = useQuery({
    queryKey: ["followups", "today"],
    queryFn: async () => {
      try {
        return asArray<Followup>(await api.get("/followups/today"));
      } catch {
        return asArray<Followup>(await api.get("/reminders/today"));
      }
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const upcomingQ = useQuery({
    queryKey: ["followups", "upcoming"],
    queryFn: async () => asArray<Followup>(await api.get("/followups/upcoming")),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const dueQ = useQuery({
    queryKey: ["reminders", "due"],
    queryFn: async () => {
      try {
        return asArray<Followup>(await api.get("/reminders/due"));
      } catch {
        return [] as Followup[];
      }
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });

  const statsQ = useQuery({
    queryKey: ["reminders", "stats"],
    queryFn: () => remindersService.stats(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });


  // Merge + dedupe across endpoints, and drop rows without a real patient name.
  const all = useMemo(() => {
    const map = new Map<string, Followup>();
    for (const list of [todayQ.data ?? [], upcomingQ.data ?? [], dueQ.data ?? []]) {
      for (const r of list) {
        const id = rowId(r);
        if (!id) continue;
        if (!rowName(r).trim()) continue; // skip "Unknown"/undefined rows
        if (!map.has(id)) map.set(id, r);
      }
    }
    return Array.from(map.values());
  }, [todayQ.data, upcomingQ.data, dueQ.data]);

  const buckets = useMemo(() => {
    const b: Record<Bucket, Followup[]> = { today: [], upcoming: [], missed: [], completed: [] };
    for (const r of all) b[classifyBucket(r)].push(r);
    // Sort each: today/upcoming by due ascending; missed by most-overdue first; completed newest first
    const byDueAsc = (a: Followup, x: Followup) =>
      (rowDueDate(a)?.getTime() ?? 0) - (rowDueDate(x)?.getTime() ?? 0);
    b.today.sort(byDueAsc);
    b.upcoming.sort(byDueAsc);
    b.missed.sort((a, x) => (rowDueDate(a)?.getTime() ?? 0) - (rowDueDate(x)?.getTime() ?? 0));
    b.completed.sort((a, x) => (rowDueDate(x)?.getTime() ?? 0) - (rowDueDate(a)?.getTime() ?? 0));
    return b;
  }, [all]);

  const sendReminder = async (row: Followup) => {
    const id = rowId(row);
    if (!id) return;
    setSending(id);
    const who = rowName(row) || "patient";
    const tid = toast.loading(`Sending WhatsApp to ${who}…`);
    try {
      await api.post(`/reminders/${encodeURIComponent(id)}/send`);
      toast.success(`Reminder sent to ${who}`, { id: tid });
      qc.invalidateQueries({ queryKey: ["followups", "today"] });
      qc.invalidateQueries({ queryKey: ["followups", "upcoming"] });
      qc.invalidateQueries({ queryKey: ["reminders", "due"] });
    } catch (e) {
      toast.error(errMsg(e), { id: tid });
    } finally {
      setSending(null);
    }
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["followups", "today"] });
    qc.invalidateQueries({ queryKey: ["followups", "upcoming"] });
    qc.invalidateQueries({ queryKey: ["reminders", "due"] });
    qc.invalidateQueries({ queryKey: ["reminders", "stats"] });
  };

  const loading = todayQ.isLoading && upcomingQ.isLoading;
  const error = todayQ.error && upcomingQ.error ? todayQ.error : null;
  const list = buckets[tab];

  // Prefer backend counts (/reminders/stats); fall back to computed buckets.
  const s = (statsQ.data ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : undefined);
  const counts = {
    today: num("today") ?? num("due_today") ?? num("pending_today") ?? buckets.today.length,
    upcoming: num("upcoming") ?? num("scheduled") ?? buckets.upcoming.length,
    missed: num("missed") ?? num("overdue") ?? num("failed") ?? buckets.missed.length,
    completed: num("completed") ?? num("done") ?? num("sent") ?? buckets.completed.length,
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {/* Header */}
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-card border-primary/20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-primary/80 font-medium">Follow-ups</div>
              <div className="font-display text-4xl mt-1 tabular-nums">
                {counts.today}
                <span className="text-muted-foreground text-2xl"> due today</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {counts.upcoming} upcoming · {counts.missed} missed · {counts.completed} completed
              </div>
            </div>
            <button
              onClick={refreshAll}
              className="h-9 px-4 rounded-full border border-border bg-card text-xs font-medium inline-flex items-center gap-1.5 hover:bg-muted"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 w-fit flex-wrap">
          <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<Send className="size-3.5" />} label="Today" count={counts.today} />
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")} icon={<CalendarClock className="size-3.5" />} label="Upcoming" count={counts.upcoming} />
          <TabButton active={tab === "missed"} onClick={() => setTab("missed")} icon={<AlertCircle className="size-3.5" />} label="Missed" count={counts.missed} />
          <TabButton active={tab === "completed"} onClick={() => setTab("completed")} icon={<CheckCircle2 className="size-3.5" />} label="Completed" count={counts.completed} />
        </div>

        {/* List */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="px-5 py-12 grid place-items-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-destructive">{errMsg(error)}</div>
          ) : list.length === 0 ? (
            <EmptyState bucket={tab} />
          ) : (
            <ul className="divide-y clinic-divider">
              {list.map((row) => (
                <FollowupRowView
                  key={rowId(row)}
                  row={row}
                  bucket={tab}
                  busy={sending === rowId(row)}
                  onSend={() => sendReminder(row)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Sidebar — pipeline */}
      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <Card>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pipeline</div>
          <div className="font-display text-lg mt-0.5">Follow-up status</div>
          <div className="mt-3 space-y-2">
            <PipelineRow label="Due today" count={counts.today} />
            <PipelineRow label="Upcoming" count={counts.upcoming} />
            <div className="border-t clinic-divider pt-2 mt-2 space-y-2">
              <PipelineRow label="Completed" count={counts.completed} accent="success" />
              <PipelineRow label="Missed" count={counts.missed} accent="danger" />
            </div>
          </div>
        </Card>
        <Card className="bg-muted/30">
          <div className="text-xs text-muted-foreground leading-relaxed">
            Follow-ups are created when a doctor submits a prescription. Reminders
            run automatically <strong className="text-foreground">3 days</strong>,
            <strong className="text-foreground"> 24 hours</strong>, and on the
            <strong className="text-foreground"> due date</strong>. Use the
            <em> Send now</em> button to push an immediate WhatsApp message.
          </div>
        </Card>
      </aside>
    </div>
  );
}

// ─────────────────────────── Bits ───────────────────────────
function TabButton({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-4 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
        active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span className="tabular-nums">· {count}</span>
    </button>
  );
}

function EmptyState({ bucket }: { bucket: Bucket }) {
  const copy: Record<Bucket, { title: string; hint: string; icon: React.ReactNode }> = {
    today: {
      title: "Nothing due today",
      hint: "Follow-ups created in consultation will appear here on their due date.",
      icon: <CheckCircle2 className="size-8 text-emerald-500/60" />,
    },
    upcoming: {
      title: "No upcoming follow-ups",
      hint: "Scheduled follow-ups from prescriptions show here until they're due.",
      icon: <CalendarClock className="size-8 text-muted-foreground/50" />,
    },
    missed: {
      title: "No missed follow-ups",
      hint: "Past-due reminders that haven't been completed appear here.",
      icon: <Inbox className="size-8 text-muted-foreground/50" />,
    },
    completed: {
      title: "No completed follow-ups yet",
      hint: "Once a patient responds or rebooks, the reminder lands here.",
      icon: <CheckCircle2 className="size-8 text-emerald-500/60" />,
    },
  };
  const c = copy[bucket];
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-2 w-fit">{c.icon}</div>
      <div className="text-sm font-medium">{c.title}</div>
      <div className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{c.hint}</div>
    </div>
  );
}

function FollowupRowView({
  row, bucket, busy, onSend,
}: { row: Followup; bucket: Bucket; busy: boolean; onSend: () => void }) {
  const due = rowDueDate(row);
  const visitDate = rowVisitDate(row);
  const cd = countdownLabel(row);
  const status = rowStatus(row);
  const phone = rowPhone(row);
  const name = rowName(row);
  const type = rowType(row);
  const canSend = bucket === "today" || bucket === "missed";
  const toneClass =
    cd.tone === "danger" ? "bg-red-500/15 text-red-700 border-red-500/30"
    : cd.tone === "warn" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : cd.tone === "ok"   ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                         : "bg-muted text-muted-foreground border-border";

  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <Avatar name={name || "?"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{name}</span>
            <Tag className={toneClass}>
              <Clock className="size-3" /> {cd.text}
            </Tag>
            {type && (
              <Tag className="bg-primary/10 text-primary border-primary/20">{type}</Tag>
            )}
            {status && status !== "PENDING" && (
              <Tag className="bg-card border-border text-foreground/70">{status}</Tag>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-mono tabular-nums">{phone || "—"}</span>
            <span>·</span>
            <span>Due {fmtDate(due)}</span>
            {visitDate && (
              <>
                <span>·</span>
                <span>Visit {fmtDate(visitDate)}</span>
              </>
            )}
          </div>
        </div>
        {canSend && (
          <button
            onClick={onSend}
            disabled={busy || !phone}
            title={!phone ? "No phone number on file" : undefined}
            className="h-9 px-4 rounded-full bg-[#25D366] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#1ebe5d] disabled:opacity-60 shrink-0"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
            Send now
          </button>
        )}
      </div>
    </li>
  );
}

function PipelineRow({ label, count, accent }: { label: string; count: number; accent?: "success" | "danger" | "muted" }) {
  const color =
    accent === "success" ? "text-emerald-700" :
    accent === "danger"  ? "text-red-700"     :
    accent === "muted"   ? "text-muted-foreground" :
                           "text-foreground";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-display text-lg tabular-nums ${color}`}>{count}</span>
    </div>
  );
}
