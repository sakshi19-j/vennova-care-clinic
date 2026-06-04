import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import { useQueue, queueActions } from "@/lib/queue-store";
import { queueStatusStyles } from "@/lib/reception-data";
import { isHomeoPatient } from "./homeopathy";
import { PlayCircle, AlertCircle, Clock, CheckCircle2, User } from "lucide-react";

export const Route = createFileRoute("/homeopathy/queue")({
  component: TodayList,
});

function TodayList() {
  const all = useQueue().filter((q) => isHomeoPatient(q.patient_id));
  const current = all.find((q) => q.status === "IN_TREATMENT");
  const waiting = all.filter((q) => q.status === "WAITING" || q.status === "CHECKED_IN")
    .sort((a, b) => (b.priority - a.priority) || (a.token_number - b.token_number));
  const done = all.filter((q) => q.status === "COMPLETED");

  const callIn = (id: string, name: string) => {
    queueActions.callIn(id);
    toast.success(`${name} is now with you`);
  };

  return (
    <div className="space-y-5">
      {current && (
        <Card className="border-success/30 bg-success/5">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-success pulse-dot" />
            <div className="text-[11px] uppercase tracking-widest text-success">Currently with you</div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={current.patient_name} size={40} />
            <div className="flex-1">
              <div className="font-medium">#{current.token_number} · {current.patient_name}</div>
              <div className="text-xs text-muted-foreground">{current.notes || "—"}</div>
            </div>
            <Link to="/homeopathy" className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2">
              Open case
            </Link>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b clinic-divider flex items-center justify-between">
          <div className="font-display text-xl">Waiting · {waiting.length}</div>
          <div className="text-xs text-muted-foreground">Tap <span className="text-foreground font-medium">Call in</span> when you're ready for the next one</div>
        </div>
        <ul className="divide-y clinic-divider">
          {waiting.map((q) => {
            const st = queueStatusStyles[q.status];
            const delayed = q.wait_minutes > 20;
            return (
              <li key={q.queue_id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40">
                <span className="font-mono text-sm w-12 text-muted-foreground">#{q.token_number}</span>
                <Avatar name={q.patient_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{q.patient_name}</span>
                    <Tag className={st.pill}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</Tag>
                    {q.priority === 1 && (
                      <Tag className="bg-destructive/15 text-destructive border-destructive/30">
                        <AlertCircle className="size-3" /> Urgent
                      </Tag>
                    )}
                  </div>
                  {q.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate">{q.notes}</div>}
                </div>
                <div className={`text-xs inline-flex items-center gap-1 px-2 h-7 rounded-full border ${delayed ? "border-destructive/40 text-destructive bg-destructive/10" : "border-border text-muted-foreground"}`}>
                  <Clock className="size-3" /> {q.wait_minutes}m
                </div>
                <Link to="/homeopathy/patients/$id" params={{ id: q.patient_id }} className="size-9 grid place-items-center rounded-lg border border-border hover:bg-muted" title="View record">
                  <User className="size-4" />
                </Link>
                <button
                  onClick={() => callIn(q.queue_id, q.patient_name)}
                  disabled={!!current}
                  title={current ? "Finish current patient first" : "Call this patient in"}
                  className="h-9 px-3 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="size-4" /> Call in
                </button>
              </li>
            );
          })}
          {waiting.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">No one waiting right now.</li>
          )}
        </ul>
      </Card>

      {done.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b clinic-divider font-display text-xl inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" /> Completed today · {done.length}
          </div>
          <ul className="divide-y clinic-divider">
            {done.map((q) => (
              <li key={q.queue_id} className="px-5 py-3 flex items-center gap-3">
                <span className="font-mono text-sm w-12 text-muted-foreground">#{q.token_number}</span>
                <Avatar name={q.patient_name} size={32} />
                <div className="flex-1 min-w-0 font-medium truncate">{q.patient_name}</div>
                <Tag className="bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30">Sent to billing</Tag>
                <Link to="/homeopathy/patients/$id" params={{ id: q.patient_id }} className="text-xs text-primary hover:underline">View →</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
