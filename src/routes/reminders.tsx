import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader, Avatar, Tag } from "@/components/clinic/PageHeader";
import { MessageCircle, Send, Check, CheckCheck, Loader2, AlertTriangle, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  remindersService, reminderId, type Reminder, type ReminderStats,
} from "@/services/reminders";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Vennova Clinic" },
      { name: "description", content: "Scheduled patient reminders and follow-up messaging status." },
      { property: "og:title", content: "Reminders — Vennova Clinic" },
      { property: "og:description", content: "Scheduled patient reminders and follow-up messaging status." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/reminders" },
      { name: "twitter:title", content: "Reminders — Vennova Clinic" },
      { name: "twitter:description", content: "Scheduled patient reminders and follow-up messaging status." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/reminders" }],
  }),
  component: Reminders,
});

const statusTag: Record<string, string> = {
  PENDING: "bg-amber-100 border-amber-300 text-amber-800",
  SENT: "bg-blue-100 border-blue-300 text-blue-800",
  DONE: "bg-green-100 border-green-300 text-green-800",
  FAILED: "bg-destructive/15 border-destructive/30 text-destructive",
};

function Reminders() {
  const qc = useQueryClient();
  const todayQ = useQuery({
    queryKey: ["reminders", "today"],
    queryFn: () => remindersService.today(),
    staleTime: 15_000, retry: 1,
  });
  const statsQ = useQuery({
    queryKey: ["reminders", "stats"],
    queryFn: () => remindersService.stats(),
    staleTime: 30_000, retry: 1,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reminders"] });
  };

  const batch = useMutation({
    mutationFn: () => remindersService.sendTodayBatch(),
    onSuccess: () => { toast.success("Today's batch queued"); invalidate(); },
    onError: (e: Error) => toast.error(e.message || "Batch send failed"),
  });

  const stats: ReminderStats = statsQ.data ?? {};
  const items = todayQ.data ?? [];

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="WhatsApp · Live" title="Followup Reminders"
        subtitle="Today's reminder queue, send tracking and clinic-wide stats — all from your backend."
        actions={
          <Button
            onClick={() => batch.mutate()}
            disabled={batch.isPending || items.length === 0}
            className="rounded-full bg-primary"
          >
            {batch.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
            Send today's batch
          </Button>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPI label="Pending" value={String(stats.pending ?? 0)} loading={statsQ.isLoading} />
        <KPI label="Sent" value={String(stats.sent ?? 0)} loading={statsQ.isLoading} />
        <KPI label="Done" value={String(stats.done ?? 0)} loading={statsQ.isLoading} />
        <KPI label="Failed" value={String(stats.failed ?? 0)} loading={statsQ.isLoading} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b clinic-divider flex items-center justify-between">
          <h2 className="font-display text-lg">Due today · {items.length}</h2>
          <span className="text-xs text-muted-foreground">/reminders/today</span>
        </div>
        {todayQ.isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : todayQ.error ? (
          <ErrPane msg={(todayQ.error as Error).message} onRetry={() => todayQ.refetch()} />
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <div className="size-10 rounded-full bg-muted mx-auto mb-3 grid place-items-center">
              <BellRing className="size-5" />
            </div>
            No reminders due today.
          </div>
        ) : (
          <ul className="divide-y clinic-divider">
            {items.map((r) => <ReminderRow key={reminderId(r)} r={r} onChanged={invalidate} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ReminderRow({ r, onChanged }: { r: Reminder; onChanged: () => void }) {
  const id = reminderId(r);
  const name = r.patient_name || "";
  const status = String(r.status ?? "PENDING").toUpperCase();

  const send = useMutation({
    mutationFn: () => remindersService.send(id),
    onSuccess: () => { toast.success(`Reminder sent to ${name}`); onChanged(); },
    onError: (e: Error) => toast.error(e.message || "Send failed"),
  });
  const markSent = useMutation({
    mutationFn: () => remindersService.markSent(id),
    onSuccess: () => { toast.success("Marked sent"); onChanged(); },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });
  const markDone = useMutation({
    mutationFn: () => remindersService.markDone(id),
    onSuccess: () => { toast.success("Marked done"); onChanged(); },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const due = r.due_at || r.due_date || r.scheduled_for;

  return (
    <li className="px-5 py-4 flex items-start gap-3">
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium truncate">{name}</div>
          <Tag className={statusTag[status] || "bg-muted text-foreground border-border"}>{status}</Tag>
          {due && <span className="text-xs text-muted-foreground ml-auto">{new Date(String(due)).toLocaleString("en-IN")}</span>}
        </div>
        {r.phone && <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{String(r.phone)}</div>}
        {(r.reason || r.message) && <div className="text-sm mt-1">{String(r.reason || r.message)}</div>}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => send.mutate()}
            disabled={send.isPending || !id}
            className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {send.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
            Send now
          </button>
          <button
            onClick={() => markSent.mutate()}
            disabled={markSent.isPending || !id}
            className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Check className="size-3.5" /> Mark sent
          </button>
          <button
            onClick={() => markDone.mutate()}
            disabled={markDone.isPending || !id}
            className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <CheckCheck className="size-3.5" /> Mark done
          </button>
        </div>
      </div>
    </li>
  );
}

function KPI({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-1">{loading ? <span className="text-muted-foreground">…</span> : value}</div>
    </Card>
  );
}

function ErrPane({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
        <AlertTriangle className="size-4" /> {msg}
      </div>
      <div className="mt-3"><Button variant="outline" onClick={onRetry} className="rounded-full">Retry</Button></div>
    </div>
  );
}
