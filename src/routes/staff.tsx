import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Staff — Vennova Clinic" }] }),
  component: Staff,
});

function Staff() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        eyebrow="Role-based access"
        title="Staff & Roles"
        subtitle="Manage doctors, receptionists and admin staff for your clinic."
      />
      <Card className="py-14 text-center">
        <div className="max-w-md mx-auto">
          <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-4">
            <Users className="size-6" />
          </div>
          <div className="font-display text-2xl">Manage staff in the Admin console</div>
          <p className="text-sm text-muted-foreground mt-2">
            Staff invitations, roles and permissions live in the Admin area.
          </p>
          <Link to="/admin/staff-management" className="inline-flex mt-5">
            <Button className="rounded-full bg-primary">
              Open staff management <ArrowRight className="size-4 ml-1" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
