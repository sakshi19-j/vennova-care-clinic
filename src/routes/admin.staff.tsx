import { createFileRoute } from "@tanstack/react-router";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { staffPerf } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/staff")({
  component: StaffPerfPage,
});

function StaffPerfPage() {
  return (
    <div className="grid grid-cols-12 gap-5">
      {staffPerf.map((s) => (
        <Card key={s.id} className="col-span-12 md:col-span-6 lg:col-span-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-11 rounded-full bg-muted text-sm font-medium flex items-center justify-center border border-border">{s.initials}</div>
            <div className="min-w-0">
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground truncate">{s.role}</div>
            </div>
          </div>
          <Tag className={s.on_duty ? "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30" : "bg-muted text-muted-foreground border-border"}>
            <span className={`size-1.5 rounded-full ${s.on_duty ? "bg-success pulse-dot" : "bg-muted-foreground"}`} />
            {s.on_duty ? "On duty" : "Off"}
          </Tag>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Patients</div>
              <div className="font-display text-xl">{s.patients_today}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg consult</div>
              <div className="font-display text-xl">{s.avg_consult_min}m</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2 col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Collections</div>
              <div className="font-display text-xl">₹{s.collections_today.toLocaleString("en-IN")}</div>
            </div>
          </div>

          {s.satisfaction > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Patient satisfaction</span>
                <span className="font-medium">{s.satisfaction}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-saffron" style={{ width: `${s.satisfaction}%` }} />
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
