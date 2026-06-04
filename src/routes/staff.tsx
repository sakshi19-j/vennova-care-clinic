import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import { staff, tagStyles } from "@/lib/clinic-data";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Staff — Vedic Clinic" }] }),
  component: Staff,
});

function Staff() {
  return (
    <div className="max-w-[1300px] mx-auto">
      <PageHeader eyebrow="Role-based access" title="Staff & Roles"
        subtitle="Manage doctors, receptionists, and assistants. Each role gets its own optimised interface."
        actions={<Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> Invite staff</Button>} />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
              <th className="text-left font-medium py-2 px-5">Member</th>
              <th className="text-left font-medium py-2 px-3">Role</th>
              <th className="text-left font-medium py-2 px-3">Email</th>
              <th className="text-left font-medium py-2 px-3">Status</th>
              <th className="py-2 px-5"> </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b clinic-divider hover:bg-muted/50">
                <td className="py-3 px-5"><div className="flex items-center gap-3"><Avatar name={s.name} /><div className="font-medium">{s.name}</div></div></td>
                <td className="py-3 px-3 text-muted-foreground">{s.role}</td>
                <td className="py-3 px-3 text-muted-foreground">{s.email}</td>
                <td className="py-3 px-3"><Tag className={s.status === "Active" ? tagStyles.active : tagStyles.lapsed}>{s.status}</Tag></td>
                <td className="py-3 px-5 text-right"><button className="text-sm text-primary hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
