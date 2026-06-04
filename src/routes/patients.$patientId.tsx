import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { getPatient, visitTimeline, tagStyles } from "@/lib/clinic-data";
import { Stethoscope, Phone, MessageCircle, Gift, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/patients/$patientId")({
  head: () => ({ meta: [{ title: "Patient — Vedic Clinic" }] }),
  component: PatientDetail,
});

type ExtraInfo = {
  dob?: string;
  referred_by_name?: string;
  referred_by_contact?: string;
};

function PatientDetail() {
  const { patientId } = Route.useParams();
  const p = getPatient(patientId);
  if (!p) return <div className="p-6">Patient not found.</div>;

  // In the current demo store these fields aren't seeded; show placeholders.
  const extra: ExtraInfo = (p as unknown as ExtraInfo) ?? {};

  const sendBirthdayWish = async () => {
    try {
      await api.post(`/whatsapp/birthday/${encodeURIComponent(patientId)}`);
      toast.success(`Birthday wish sent to ${p.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message ?? "Failed to send wish");
    }
  };

  return (
    <div className="max-w-[1300px] mx-auto">
      <PageHeader eyebrow={p.id} title={p.name}
        subtitle={`${p.age}/${p.sex} · ${p.phone} · ${p.visits} visits · last ${p.lastVisit}`}
        actions={
          <>
            <Button variant="outline" className="rounded-full"><Phone className="size-4 mr-1" /> Call</Button>
            <Button variant="outline" className="rounded-full"><MessageCircle className="size-4 mr-1" /> WhatsApp</Button>
            <Link to="/consultation/$visitId" params={{ visitId: "V-2058" }} className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm">
              <Stethoscope className="size-4" /> Open consultation
            </Link>
          </>
        } />
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-4">
          <div className="font-display text-xl mb-3">Profile</div>
          <div className="space-y-2 text-sm">
            <Row l="Constitution" v={p.constitution || "—"} />
            <Row l="Miasm" v={p.miasm || "—"} />
            <Row l="Phone" v={p.phone} />
            <Row l="Last visit" v={p.lastVisit} />
            <Row l="Birthday" v={extra.dob || "Not on file"} />
            <Row l="Referred by" v={extra.referred_by_name ? `${extra.referred_by_name}${extra.referred_by_contact ? ` (${extra.referred_by_contact})` : ""}` : "—"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tags.map((t) => <Tag key={t} className={tagStyles[t]}>{t}</Tag>)}
          </div>

          <div className="mt-4 pt-4 border-t clinic-divider space-y-2">
            <Button
              variant="outline"
              className="rounded-full w-full justify-start"
              onClick={sendBirthdayWish}
            >
              <Gift className="size-4 mr-2 text-saffron" />
              Send birthday wish via WhatsApp
            </Button>
            {extra.referred_by_name && (
              <div className="text-xs text-muted-foreground inline-flex items-start gap-1.5">
                <UserPlus className="size-3.5 mt-0.5 shrink-0 text-primary" />
                <span>Referred by <strong>{extra.referred_by_name}</strong>{extra.referred_by_contact ? ` — ${extra.referred_by_contact}` : ""}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <div className="font-display text-xl mb-3">Visit timeline</div>
          <ol className="relative pl-5">
            <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
            {visitTimeline.map((v, i) => (
              <li key={i} className="relative pb-4 last:pb-0">
                <span className={`absolute -left-[14px] top-1 size-2.5 rounded-full ${v.trend === "up" ? "bg-success" : "bg-muted-foreground"} ring-2 ring-background`} />
                <div className="text-xs text-muted-foreground">{v.date}</div>
                <div className="text-sm mt-0.5">{v.note}</div>
                <div className="text-[11px] mt-1 text-primary">{v.remedy}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between text-sm gap-2"><span className="text-muted-foreground shrink-0">{l}</span><span className="font-medium text-right">{v}</span></div>;
}
