import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/clinic/PageHeader";
import {
  queueActions,
  useQueue,
  useRecent,
  useCalls,
  findPatient,
  feeFor,
  type RxQueueRow,
  type CallNotification,
} from "@/lib/queue-store";
import type { RxPatient, VisitType } from "@/lib/reception-data";
import {
  Search,
  SkipForward,
  Undo2,
  AlertTriangle,
  Check,
  CornerDownLeft,
  UserPlus,
  X,
  Receipt,
  ArrowRight,
  BellRing,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/reception/")({
  component: QueuePage,
});

const ROW_H = 56;
const OVERSCAN = 6;

function QueuePage() {
  const list = useQueue();
  const recent = useRecent();
  const calls = useCalls();
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<RxPatient | null>(null);
  const [visitType, setVisitType] = useState<VisitType>("WALKIN");
  const [activeIdx, setActiveIdx] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPrefill, setQuickPrefill] = useState<{ name?: string; phone?: string }>({});
  // FIX 6: disable add for 2s after click to prevent rapid double-add
  const [addDisabled, setAddDisabled] = useState(false);

  // Toast + (optional) ping whenever a brand-new call notification arrives
  const seenCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of calls) {
      if (seenCallIds.current.has(c.id)) continue;
      seenCallIds.current.add(c.id);
      toast.success(
        `${c.doctor === "HOMEOPATHY" ? "Homeopathy" : "Doctor"} is ready — send #${c.token_number} ${c.patient_name}`,
        { duration: 8000 },
      );
    }
  }, [calls]);

  const calledQueueIds = useMemo(() => new Set(calls.map((c) => c.queue_id)), [calls]);

  const queue = useMemo(() => {
    // Reception active queue: WAITING only.
    // IN_TREATMENT / BILLING_PENDING are surfaced as KPIs.
    // COMPLETED is removed instantly.
    return [...list]
      .filter((r) => r.status === "WAITING")
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.wait_minutes - a.wait_minutes;
      });
  }, [list]);

  useEffect(() => {
    if (activeIdx >= queue.length) setActiveIdx(Math.max(0, queue.length - 1));
  }, [queue.length, activeIdx]);

  const matches = useMemo(() => (picked ? [] : findPatient(q)), [q, picked]);
  const phoneOnly = /^[+\d\s-]{6,}$/.test(q.trim());
  const isNewCandidate = !picked && q.trim().length > 0 && matches.length === 0;

  const addExisting = useCallback(
    async (p: RxPatient) => {
      if (addDisabled) return;
      // FIX 6: local pre-check — block if patient is already in an active state
      const ACTIVE = new Set(["WAITING", "IN_TREATMENT", "BILLING_PENDING"]);
      const existing = list.find(
        (q) =>
          (q.patient_id === p.id ||
            q.patient_phone.replace(/\s+/g, "") === (p.phone || "").replace(/\s+/g, "")) &&
          ACTIVE.has(q.status),
      );
      if (existing) {
        toast.error("Patient already in queue");
        return;
      }
      setAddDisabled(true);
      setTimeout(() => setAddDisabled(false), 2000);
      try {
        const res = await queueActions.add({
          patient_id: p.id,
          patient_name: p.full_name,
          patient_phone: p.phone,
          visit_type: visitType,
        });
        if (res.duplicate) {
          toast.error("Patient already in queue");
        } else {
          toast.success(`#${res.token} · ${p.full_name} added to queue`);
        }
        setQ(""); setPicked(null);
        searchRef.current?.focus();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to add patient to queue";
        toast.error(message);
      }
    },
    [visitType, list, addDisabled],
  );

  const openQuickFromSearch = useCallback(() => {
    const raw = q.trim();
    let name = "", phone = "";
    if (raw.includes(",")) {
      const [n, p] = raw.split(",");
      name = n.trim(); phone = (p || "").trim();
    } else if (phoneOnly) {
      phone = raw;
    } else {
      name = raw;
    }
    setQuickPrefill({ name, phone });
    setQuickOpen(true);
  }, [q, phoneOnly]);

  const skip = useCallback((row: RxQueueRow) => {
    queueActions.skip(row.queue_id);
    toast(`Skipped · ${row.patient_name}`);
  }, []);
  const undo = useCallback(() => {
    const ok = queueActions.undo();
    if (ok) toast("Undone");
    else toast.error("Nothing to undo");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault(); undo(); return;
      }
      if (!inField && e.key === "/") {
        e.preventDefault(); searchRef.current?.focus(); return;
      }
      if (inField) return;
      const row = queue[activeIdx];
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(queue.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
      else if (row && e.key.toLowerCase() === "s") { if (row.status === "WAITING" || row.status === "CHECKED_IN") skip(row); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, activeIdx, skip, undo]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // FIX 3: waiting/in/billing/done counts come from /queue/stats/today
  // (single backend source of truth). Revenue stays local until backend exposes it.
  const statsQ = useQuery({
    queryKey: ["queue", "stats-today"],
    queryFn: () => api.get<Record<string, unknown>>("/queue/stats/today"),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
  });
  const stats = useMemo(() => {
    let revenue = 0;
    for (const r of list) if (r.status === "COMPLETED" && r.paid) revenue += r.fee;
    const sd = (statsQ.data ?? {}) as Record<string, unknown>;
    const n = (v: unknown) =>
      typeof v === "number" ? v : typeof v === "string" && !Number.isNaN(Number(v)) ? Number(v) : 0;
    return {
      waiting: n(sd.waiting),
      in: n(sd.in_treatment),
      billing: n(sd.billing_pending ?? sd.billing),
      done: n(sd.completed),
      revenue,
    };
  }, [list, statsQ.data]);

  return (
    <Card className="p-0 overflow-hidden">
      {/* ── Command bar ── */}
      <div className="px-4 md:px-5 py-3 border-b clinic-divider">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setPicked(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (matches.length > 0) addExisting(matches[0]);
                  else if (isNewCandidate) openQuickFromSearch();
                } else if (e.key === "Escape") {
                  setQ(""); (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search mobile or name — Enter to add to queue"
              className="w-full h-11 pl-10 pr-[12.5rem] rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {(["WALKIN", "APPOINTMENT"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisitType(v)}
                  className={[
                    "h-8 px-2.5 rounded-md text-[11px] font-medium uppercase tracking-wider transition",
                    visitType === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                  title={`Visit type: ${v}`}
                >
                  {v === "WALKIN" ? "Walk-in" : "Booked"}
                </button>
              ))}
            </div>

            {(matches.length > 0 || isNewCandidate) && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                {matches.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => addExisting(p)}
                    className={[
                      "w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 text-sm",
                      i === 0 ? "bg-muted/60" : "hover:bg-muted/60",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.reg_no} · {p.phone} · {p.total_visits} visits
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
                      <CornerDownLeft className="size-3" /> add to queue
                    </span>
                  </button>
                ))}
                {isNewCandidate && (
                  <button
                    onClick={openQuickFromSearch}
                    className="w-full text-left px-3 py-2.5 border-t border-border hover:bg-muted/60 text-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">Register new · "{q.trim()}"</div>
                      <div className="text-xs text-muted-foreground">Opens quick add — name + phone only</div>
                    </div>
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
                      <UserPlus className="size-3" /> new
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={addDisabled}
              onClick={() => { setQuickPrefill({}); setQuickOpen(true); }}
              className="h-11 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              <UserPlus className="size-4" /> Quick add
            </button>
            <button
              onClick={undo}
              className="h-11 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs inline-flex items-center gap-1.5"
              title="Undo last action (Ctrl/Cmd+Z)"
            >
              <Undo2 className="size-3.5" /> Undo
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <Stat label="In queue" value={stats.waiting} tone="amber" />
          <Stat label="With doctor" value={stats.in} tone="primary" />
          <Stat label="Billing" value={stats.billing} tone="gold" />
          <Stat label="Done" value={stats.done} tone="success" />
          <Stat label="Today" value={`₹${stats.revenue}`} tone="gold" />
          {recent.length > 0 && (
            <div className="flex items-center gap-2 ml-auto overflow-hidden">
              <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Recent</span>
              {recent.map((r) => (
                <span key={r.at} className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-muted/60 text-[11px] text-muted-foreground">
                  <Check className="size-3" /> {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Doctor call notifications ── */}
      {calls.length > 0 && (
        <div className="px-4 md:px-5 py-3 border-b clinic-divider bg-primary/5 space-y-2">
          {calls.map((c) => (
            <CallBanner key={c.id} call={c} />
          ))}
        </div>
      )}

      {/* ── Queue list ── */}
      <VirtualList
        rows={queue}
        activeIdx={activeIdx}
        calledIds={calledQueueIds}
        onActivate={setActiveIdx}
        onSkip={skip}
        onBilling={() => { navigate({ to: "/reception/billing" }); }}
      />

      {/* ── Footer hints ── */}
      <div className="px-4 md:px-5 h-10 border-t clinic-divider bg-card/60 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
        <Kbd>↑↓</Kbd> nav <Kbd>S</Kbd> skip <Kbd>/</Kbd> search <Kbd>⌘Z</Kbd> undo
        <span className="ml-auto whitespace-nowrap">
          Payments are collected in the <span className="font-medium">Billing</span> tab · ₹{feeFor("WALKIN")} / ₹{feeFor("APPOINTMENT")}
        </span>
      </div>


      <QuickAddDialog
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        prefill={quickPrefill}
        visitType={visitType}
        setVisitType={setVisitType}
        onSubmit={async ({ name, phone }) => {
          try {
            const created = await api.post<{ id?: string; reg_no?: string | number }>("/patients", {
              first_name: name.split(" ")[0] || name,
              last_name: name.split(" ").slice(1).join(" ") || null,
              phone_mobile: phone,
              patient_type: "HOMEOPATHY",
            });
            if (!created?.id) {
              toast.error("Patient created but no id returned");
              return;
            }
            const reg_no = created.reg_no != null ? String(created.reg_no) : "";
            const { patient } = queueActions.createPatient(created.id, reg_no, name, phone, {
              patient_type: "HOMEOPATHY",
            });
            await addExisting(patient);
            setQuickOpen(false);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create patient";
            toast.error(msg);
          }
        }}
      />
    </Card>
  );
}

// ─── Quick Add Dialog ───
function QuickAddDialog({
  open, onClose, prefill, visitType, setVisitType, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  prefill: { name?: string; phone?: string };
  visitType: VisitType;
  setVisitType: (v: VisitType) => void;
  onSubmit: (v: { name: string; phone: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(prefill.name || "");
      setPhone(prefill.phone || "");
      setTimeout(() => {
        (prefill.name && !prefill.phone ? document.getElementById("qa-phone") : nameRef.current)?.focus();
      }, 30);
    }
  }, [open, prefill]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    {
      const raw = phone.trim();
      const digits = raw.replace(/[^\d]/g, "");
      if (!/^[+\d\s-]{6,20}$/.test(raw) || digits.length < 6 || digits.length > 15) {
        return toast.error("Enter a valid phone (6–15 digits, +, spaces allowed)");
      }
    }
    onSubmit({ name: name.trim(), phone: phone.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-md clinic-card p-5 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center"><UserPlus className="size-4" /></div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">New patient</div>
              <h2 className="font-display text-xl leading-none mt-0.5">Quick register</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="size-8 rounded-full hover:bg-muted grid place-items-center"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Full name</label>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Anjali Mehta"
              className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Mobile</label>
            <input id="qa-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98xxxxxxxx" inputMode="tel"
              className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Visit type</label>
            <div className="flex gap-1.5">
              {(["WALKIN", "APPOINTMENT"] as const).map((v) => (
                <button type="button" key={v} onClick={() => setVisitType(v)}
                  className={`flex-1 h-10 rounded-lg border text-xs font-medium ${visitType === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                  {v === "WALKIN" ? "Walk-in" : "Booked"}
                </button>
              ))}

            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Patient is added directly to queue. More details can be filled from the patient profile.</p>
        </div>

        <div className="flex justify-end gap-2 mt-5 border-t clinic-divider pt-4">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full border border-border text-sm hover:bg-muted">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2">
            <UserPlus className="size-4" /> Add to queue
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Virtualized list ──
function VirtualList({
  rows, activeIdx, calledIds, onActivate, onSkip, onBilling,
}: {
  rows: RxQueueRow[];
  activeIdx: number;
  calledIds: Set<string>;
  onActivate: (i: number) => void;
  onSkip: (r: RxQueueRow) => void;
  onBilling: (r: RxQueueRow) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [vh, setVh] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setVh(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = activeIdx * ROW_H;
    if (top < el.scrollTop) el.scrollTo({ top });
    else if (top + ROW_H > el.scrollTop + el.clientHeight)
      el.scrollTo({ top: top + ROW_H - el.clientHeight });
  }, [activeIdx]);

  const total = rows.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + vh) / ROW_H) + OVERSCAN);
  const slice = rows.slice(start, end);

  if (total === 0) {
    return (
      <div className="h-[420px] grid place-items-center text-sm text-muted-foreground">
        Queue is empty. Search a patient above or click <span className="font-medium mx-1">Quick add</span> to start.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      className="overflow-auto"
      style={{ height: "min(calc(100vh - 320px), 720px)", minHeight: 360 }}
    >
      <div style={{ height: total * ROW_H, position: "relative" }}>
        {slice.map((r, i) => {
          const idx = start + i;
          return (
            <QueueRow
              key={r.queue_id}
              row={r}
              top={idx * ROW_H}
              active={idx === activeIdx}
              called={calledIds.has(r.queue_id)}
              onActivate={() => onActivate(idx)}
              onSkip={() => onSkip(r)}
              onBilling={() => onBilling(r)}
            />
          );
        })}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  WAITING: "Waiting", CHECKED_IN: "Ready", IN_TREATMENT: "With doctor",
  BILLING_PENDING: "Billing", DONE: "Done", COMPLETED: "Done", NO_SHOW: "No-show", CANCELLED: "Cancelled",
};
const STATUS_TONE: Record<string, string> = {
  WAITING: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  CHECKED_IN: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  IN_TREATMENT: "bg-primary/15 text-primary border-primary/30",
  BILLING_PENDING: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  DONE: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  NO_SHOW: "bg-destructive/10 text-destructive border-destructive/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

function QueueRow({
  row, top, active, called, onActivate, onSkip, onBilling,
}: {
  row: RxQueueRow;
  top: number;
  active: boolean;
  called: boolean;
  onActivate: () => void;
  onSkip: () => void;
  onBilling: () => void;
}) {
  const isBooked = row.visit_type === "APPOINTMENT";
  const canSkip = row.status === "WAITING" || row.status === "CHECKED_IN";
  const isDone = row.status === "DONE" || row.status === "COMPLETED";
  const awaitingPayment = isDone && !row.paid;
  // Live wait derived from queue check-in time (stored as ms in queue-store).
  const liveWait = row.created_at
    ? Math.max(0, Math.floor((Date.now() - row.created_at) / 60000))
    : row.wait_minutes;
  const delayed = liveWait > 20;


  return (
    <div
      onClick={onActivate}
      style={{ position: "absolute", top, left: 0, right: 0, height: ROW_H }}
      className={[
        "flex items-center gap-3 px-4 md:px-5 border-b border-border/60 cursor-default transition-colors",
        called
          ? "bg-primary/15 ring-2 ring-primary/60 ring-inset animate-pulse"
          : active
            ? "bg-primary/[0.06] ring-1 ring-primary/30 ring-inset"
            : "hover:bg-muted/40",
        row.status === "NO_SHOW" ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className="shrink-0 min-w-[3rem] sm:min-w-[3.5rem] font-mono text-sm text-muted-foreground tabular-nums">
        #{row.token_number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={["truncate", isBooked ? "font-semibold text-foreground" : "font-medium text-foreground/85"].join(" ")}>
            {row.patient_name}
          </span>
          {row.priority === 1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 h-4 rounded-sm bg-destructive/15 text-destructive border border-destructive/30 uppercase tracking-wider">
              <AlertTriangle className="size-2.5" /> Urg
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1 min-w-0">
          <span className="font-mono whitespace-nowrap shrink-0">{row.patient_phone}</span>
          {row.reg_no && <span className="whitespace-nowrap shrink-0">· {row.reg_no}</span>}
          {row.notes && <span className="truncate">· {row.notes}</span>}
        </div>

      </div>

      <div className={[
        "hidden sm:inline-block w-16 text-[10px] uppercase tracking-wider text-center py-0.5 rounded-sm border",
        isBooked ? "border-primary/40 text-primary bg-primary/5" : "border-border text-muted-foreground",
      ].join(" ")}>
        {isBooked ? "Booked" : "Walk-in"}
      </div>

      <div className={[
        "hidden lg:inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] border",
        STATUS_TONE[row.status],
      ].join(" ")}>
        {STATUS_LABEL[row.status]}
      </div>

      <div className={[
        "hidden md:block w-10 text-right text-[11px] tabular-nums",
        delayed ? "text-destructive font-medium" : "text-muted-foreground",
      ].join(" ")}>
        {isDone || row.status === "NO_SHOW" ? "—" : `${liveWait}m`}
      </div>

      <div className="flex items-center gap-1.5">
        {canSkip && (
          <ActionBtn onClick={onSkip} tone="ghost" icon={<SkipForward className="size-3.5" />}>Skip</ActionBtn>
        )}
        {awaitingPayment && (
          <ActionBtn onClick={onBilling} tone="billing" icon={<Receipt className="size-3.5" />}>
            Bill ₹{row.fee} <ArrowRight className="size-3" />
          </ActionBtn>
        )}
        {row.paid && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 px-2 h-7">
            <Check className="size-3.5" /> Paid ₹{row.fee}
            {row.paid_with && <span className="text-muted-foreground">· {row.paid_with}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Doctor → reception call banner ──
function CallBanner({ call }: { call: CallNotification }) {
  const [secs, setSecs] = useState(Math.floor((Date.now() - call.at) / 1000));
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.floor((Date.now() - call.at) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call.at]);

  const isHomeo = call.doctor === "HOMEOPATHY";
  const Icon = isHomeo ? Sparkles : Stethoscope;
  const room = isHomeo ? "Homeopathy" : "Allopathy";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 shadow-sm">
      <div className="size-9 rounded-full bg-primary/20 text-primary grid place-items-center shrink-0 animate-pulse">
        <BellRing className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-primary inline-flex items-center gap-1">
          <Icon className="size-3" /> {room} · ready now
        </div>
        <div className="text-sm font-medium truncate">
          Send #{call.token_number} · {call.patient_name} in
        </div>
      </div>
      <span className="hidden sm:inline text-[11px] text-muted-foreground tabular-nums">
        {secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`}
      </span>
      <button
        onClick={() => {
          queueActions.acknowledgeCall(call.id);
          toast(`Sent ${call.patient_name} in`);
        }}
        className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 shrink-0"
      >
        <Check className="size-4" /> Sent in
      </button>
    </div>
  );
}

function ActionBtn({
  children, onClick, tone, icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "primary" | "ghost" | "success" | "gold" | "billing";
  icon?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent",
    ghost: "bg-transparent text-muted-foreground hover:bg-muted border border-border",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 border border-transparent",
    gold: "bg-amber-500 text-white hover:bg-amber-600 border border-transparent",
    billing: "bg-violet-600 text-white hover:bg-violet-700 border border-transparent",
  };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={["h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1 transition-colors active:scale-[0.98]", tones[tone]].join(" ")}
    >
      {icon}{children}
    </button>
  );
}

function Stat({
  label, value, tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: "amber" | "primary" | "success" | "gold";
}) {
  const colors: Record<string, string> = {
    amber: "text-amber-700",
    primary: "text-primary",
    success: "text-emerald-700",
    gold: "text-amber-600",
  };
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-display text-base tabular-nums ${colors[tone]}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-border bg-card text-[10px] font-medium text-foreground/80">
      {children}
    </kbd>
  );
}
