import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ListOrdered, Calendar, Stethoscope, Users, FileText, Receipt, BellRing, BarChart3 } from "lucide-react";
import { patients } from "@/lib/clinic-data";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string, params?: Record<string, string>) => {
    onOpenChange(false);
    // Defer navigation so the Dialog's focus-restore / unmount doesn't swallow it.
    setTimeout(() => {
      navigate({ to, params } as any);
    }, 0);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        <Command>
          <CommandInput placeholder="Type a command or patient name…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => go("/")}><LayoutDashboard className="size-4 mr-2" /> Dashboard</CommandItem>
              <CommandItem onSelect={() => go("/queue")}><ListOrdered className="size-4 mr-2" /> Live Queue</CommandItem>
              <CommandItem onSelect={() => go("/appointments")}><Calendar className="size-4 mr-2" /> Appointments</CommandItem>
              <CommandItem onSelect={() => go("/consultation/$visitId", { visitId: "V-2058" })}><Stethoscope className="size-4 mr-2" /> Consultation</CommandItem>
              <CommandItem onSelect={() => go("/patients")}><Users className="size-4 mr-2" /> Patients</CommandItem>
              <CommandItem onSelect={() => go("/prescriptions")}><FileText className="size-4 mr-2" /> Prescriptions</CommandItem>
              <CommandItem onSelect={() => go("/billing")}><Receipt className="size-4 mr-2" /> Billing</CommandItem>
              <CommandItem onSelect={() => go("/reminders")}><BellRing className="size-4 mr-2" /> Reminders</CommandItem>
              <CommandItem onSelect={() => go("/analytics")}><BarChart3 className="size-4 mr-2" /> Analytics</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Patients">
              {patients.slice(0, 6).map((p) => (
                <CommandItem key={p.id} onSelect={() => go("/patients/$patientId", { patientId: p.id })}>
                  <span className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] mr-2">
                    {p.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </span>
                  {p.name}
                  <span className="ml-auto text-xs text-muted-foreground">{p.id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
