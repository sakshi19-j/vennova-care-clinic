import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import {
  queue, getPatient, todaySchedule, reminders, recentReplies, completedToday,
  visits7d, tagStyles,
} from "@/lib/clinic-data";
import {
  ArrowRight, Phone, Plus, AlertTriangle, Clock, ChevronRight,
  Stethoscope, FileText, Receipt, BellRing, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clinic Dashboard — Vedic Homeopathic Clinic" },
      { name: "description", content: "Your clinic at a glance: live queue, today's schedule, urgent follow-ups and revenue trends — the doctor's daily home base." },
      { property: "og:title", content: "Clinic Dashboard — Vedic Homeopathic Clinic" },
      { property: "og:description", content: "Live queue, today's schedule, urgent follow-ups and clinic revenue at a glance." },
      { property: "og:url", content: "https://care-flow-fix.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://care-flow-fix.lovable.app/" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const inConsult = queue.find((q) => q.status === "in-consult");
  const waiting = queue.filter((q) => q.status === "waiting");
  const inConsultPatient = inConsult ? getPatient(inConsult.patientId) : null;
  const overdue = reminders.filter((r) => r.sentiment === "overdue" || r.sentiment === "unresponsive");

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow={`Today · ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`}
        title="Clinic Dashboard"
        subtitle={<>Namaste, Dr. Sharma. You have <strong className="text-foreground">{waiting.length} patients waiting</strong> and {todaySchedule.length} appointments today. {overdue.length} follow-ups need attention.</>}
        actions={
          <>
            <Button variant="outline" className="rounded-full">Day plan</Button>
            <Button className="rounded-full bg-primary hover:bg-primary/90">
              <Plus className="size-4 mr-1" /> New Visit
            </Button>
          </>
        }
      />

      {/* Critical row: Now consulting + Queue + Up next */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: Live queue (priority) */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <Card className="bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_85%,black)] text-primary-foreground border-transparent relative overflow-hidden">
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary-foreground/70">
              <span className="size-1.5 rounded-full bg-success pulse-dot" /> Live · auto-refresh
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70 mb-3">Now consulting</div>
            {inConsultPatient && inConsult ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="font-display text-saffron text-3xl">#{inConsult.token}</span>
                  <h2 className="font-display text-4xl leading-none">{inConsultPatient.name}</h2>
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm text-primary-foreground/80">
                  <span>{inConsultPatient.age}/{inConsultPatient.sex}</span>
                  <span className="opacity-50">·</span>
                  <span>Visit #{inConsultPatient.visits}</span>
                  <span className="opacity-50">·</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {inConsult.consultMin}m in consult</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {inConsultPatient.tags.map((t) => (
                    <Tag key={t} className="bg-white/10 border-white/15 text-primary-foreground/90">{t}</Tag>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/queue" className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-gold text-gold-foreground font-medium hover:brightness-105">
                    <Stethoscope className="size-4" /> Open queue
                  </Link>
                  <button className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white/10 border border-white/15 hover:bg-white/15">
                    Call next <ArrowRight className="size-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-primary-foreground/70">No active consultation.</div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display text-xl">Waiting · {waiting.length}</div>
                <div className="text-xs text-muted-foreground">Avg wait 11m · 1 elderly · 1 child</div>
              </div>
              <Link to="/queue" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                Open queue <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <ul className="space-y-1.5">
              {waiting.slice(0, 5).map((q) => {
                const p = getPatient(q.patientId)!;
                return (
                  <li key={q.token} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 border border-transparent hover:border-border">
                    <span className="font-mono text-xs text-muted-foreground w-8">#{q.token}</span>
                    <Avatar name={p.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Tag className={tagStyles[q.type === "Follow-up" ? "follow-up" : "new"]}>{q.type}</Tag>
                        {q.priority && <Tag className={tagStyles[q.priority as keyof typeof tagStyles] || ""}>{q.priority}</Tag>}
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" />{q.waitingMin}m</span>
                      </div>
                    </div>
                    <button className="px-3 h-8 text-xs rounded-full border border-border hover:bg-primary hover:text-primary-foreground">Call</button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* CENTER: Today schedule + quick actions + recent activity */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-xl">Today's schedule</div>
              <Link to="/appointments" className="text-sm text-primary hover:underline">All</Link>
            </div>
            <ul className="space-y-1">
              {todaySchedule.map((s, i) => {
                const p = getPatient(s.patientId)!;
                return (
                  <li key={i} className="flex items-center gap-3 py-2 border-b last:border-0 clinic-divider">
                    <div className="font-mono text-sm text-muted-foreground w-12">{s.time}</div>
                    <Avatar name={p.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.age}/{p.sex} · Visit #{p.visits}</div>
                    </div>
                    <Tag className={tagStyles[s.type === "Follow-up" ? "follow-up" : "new"]}>{s.type}</Tag>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <div className="font-display text-xl mb-3">Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Stethoscope, label: "New consultation", to: "/consultation/V-2058" },
                { icon: FileText, label: "New prescription", to: "/prescriptions" },
                { icon: Receipt, label: "Take payment", to: "/billing" },
                { icon: BellRing, label: "Send reminders", to: "/reminders" },
              ].map((a) => (
                <Link key={a.label} to={a.to} className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-border hover:bg-muted/60 transition">
                  <span className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <a.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="font-display text-xl mb-3">Recent consultations</div>
            <ul className="space-y-1">
              {completedToday.map((c) => {
                const p = getPatient(c.patientId)!;
                return (
                  <li key={c.token} className="flex items-center gap-3 py-2 border-b last:border-0 clinic-divider">
                    <Avatar name={p.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">#{c.token} · {c.type}</div>
                    </div>
                    <Tag className={c.status === "no-show" ? tagStyles.lapsed : tagStyles.active}>
                      {c.status === "no-show" ? "No-show" : "Seen"}
                    </Tag>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* RIGHT: Reminders + emergency notes + KPIs */}
        <div className="col-span-12 lg:col-span-3 space-y-5">
          <Card className="border-saffron/40 bg-[color-mix(in_oklab,var(--saffron)_8%,var(--card))]">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-saffron" />
              <div className="font-display text-lg">Needs attention</div>
            </div>
            <ul className="space-y-2.5">
              {overdue.map((r) => {
                const p = getPatient(r.patientId)!;
                return (
                  <li key={r.id} className="text-sm">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{r.reason}</div>
                  </li>
                );
              })}
              <li className="text-sm pt-2 border-t clinic-divider">
                <div className="font-medium">Emergency note</div>
                <div className="text-xs text-muted-foreground">P-1037 reports new chest discomfort — flag senior review.</div>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="font-display text-xl mb-3">Pending</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unsigned RX</span>
                <span className="font-medium">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending payments</span>
                <span className="font-medium">₹2,300</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unread WhatsApp</span>
                <span className="font-medium">5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Lab results</span>
                <span className="font-medium">2</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="font-display text-xl mb-3">Today at a glance</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Revenue" value="₹27,400" sub="+18% vs yest." />
              <Stat label="Patients" value="36" sub="+6 today" />
              <Stat label="Avg wait" value="11m" sub="-2m" />
              <Stat label="No-shows" value="1" sub="2.7%" />
            </div>
          </Card>
        </div>
      </div>

      {/* Demoted: secondary analytics row */}
      <div className="mt-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Secondary</div>
            <div className="font-display text-2xl">This week</div>
          </div>
          <Link to="/analytics" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            Open analytics <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MiniBar title="Visits per day" data={visits7d} />
            <MiniKPI title="Retention 30-day" value="84%" trend="+3" />
            <MiniKPI title="Follow-up adherence" value="74%" trend="+5" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border p-3 bg-background/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl mt-0.5">{value}</div>
      <div className="text-[11px] text-success">{sub}</div>
    </div>
  );
}

function MiniBar({ title, data }: { title: string; data: { day: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div>
      <div className="text-sm text-muted-foreground mb-3">{title}</div>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-md bg-gradient-to-t from-saffron to-gold"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            <div className="text-[10px] text-muted-foreground">{d.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniKPI({ title, value, trend }: { title: string; value: string; trend: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">{title}</div>
      <div className="font-display text-4xl">{value}</div>
      <div className="text-xs text-success mt-1 inline-flex items-center gap-1"><Activity className="size-3" /> {trend} vs last week</div>
    </div>
  );
}
