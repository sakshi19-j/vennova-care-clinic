import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import { reminders, getPatient, recentReplies, tagStyles } from "@/lib/clinic-data";
import { MessageCircle, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reminders")({
  head: () => ({ meta: [{ title: "Reminders — Vedic Clinic" }] }),
  component: Reminders,
});

const sentimentTag: Record<string, string> = {
  active: tagStyles.active,
  unresponsive: tagStyles.lapsed,
  recovering: tagStyles["follow-up"],
  overdue: "bg-destructive/15 border-destructive/30 text-destructive",
};

function Reminders() {
  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="WhatsApp · Twilio" title="Smart Reminders"
        subtitle="Auto-scheduled follow-ups, sentiment indicators, two-way replies and template preview."
        actions={
          <>
            <Button variant="outline" className="rounded-full">Templates</Button>
            <Button className="rounded-full bg-primary"><Send className="size-4 mr-1" /> Send today's batch</Button>
          </>
        } />

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-7">
          <div className="font-display text-2xl mb-3">Due today · {reminders.length}</div>
          <ul className="space-y-3">
            {reminders.map((r) => {
              const p = getPatient(r.patientId)!;
              return (
                <li key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium">{p.name}</div>
                        <Tag className={sentimentTag[r.sentiment]}>{r.sentiment}</Tag>
                        <span className="text-xs text-muted-foreground ml-auto">Today {r.time}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.phone}</div>
                      <div className="text-sm mt-1">{r.reason}</div>
                      <div className="flex gap-2 mt-3">
                        <button className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1.5"><Check className="size-3.5" /> Mark sent</button>
                        <button className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5"><MessageCircle className="size-3.5" /> Send now</button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="col-span-12 lg:col-span-5 space-y-5">
          <Card>
            <div className="font-display text-2xl mb-3 inline-flex items-center gap-2">Recent replies</div>
            <ul className="space-y-3">
              {recentReplies.map((r, i) => {
                const p = getPatient(r.patientId)!;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span className="size-8 rounded-full bg-success/20 text-success flex items-center justify-center"><MessageCircle className="size-4" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><div className="font-medium text-sm">{p.name}</div><span className="ml-auto text-xs text-muted-foreground">{r.time}</span></div>
                      <div className="text-sm text-muted-foreground">{r.text}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Template preview</div>
            <div className="rounded-xl bg-[color-mix(in_oklab,var(--success)_8%,var(--card))] border border-success/20 p-4 text-sm">
              <div>Hello Anjali 🙏</div>
              <p className="mt-2 text-muted-foreground">
                This is a gentle reminder for your follow-up with Dr. Sharma at Vedic Homeopathic Clinic.
                Reply <strong>YES</strong> to confirm, <strong>RESCHEDULE</strong> to change, or <strong>NO</strong> to cancel.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
