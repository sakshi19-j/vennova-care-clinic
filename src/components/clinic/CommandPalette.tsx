import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ListOrdered, Calendar, Stethoscope, Users,
  Receipt, BellRing, Settings, Loader2,
} from "lucide-react";
import { patientsService, patientDisplayName, type Patient } from "@/services/patients";

export function CommandPalette({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await patientsService.list({ search: term, limit: 6 });
        if (!cancelled) setResults(r.items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const go = (to: string, params?: Record<string, string>) => {
    onOpenChange(false);
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to, params } as any);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a command or search patients…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" /> Searching…</span>
              ) : q.trim().length >= 2 ? "No patients found." : "No results."}
            </CommandEmpty>
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => go("/")}><LayoutDashboard className="size-4 mr-2" /> Dashboard</CommandItem>
              <CommandItem onSelect={() => go("/queue")}><ListOrdered className="size-4 mr-2" /> Live Queue</CommandItem>
              <CommandItem onSelect={() => go("/appointments")}><Calendar className="size-4 mr-2" /> Appointments</CommandItem>
              <CommandItem onSelect={() => go("/queue")}><Stethoscope className="size-4 mr-2" /> Consultation queue</CommandItem>
              <CommandItem onSelect={() => go("/patients")}><Users className="size-4 mr-2" /> Patients</CommandItem>
              <CommandItem onSelect={() => go("/prescriptions")}><FileText className="size-4 mr-2" /> Prescriptions</CommandItem>
              <CommandItem onSelect={() => go("/billing")}><Receipt className="size-4 mr-2" /> Billing</CommandItem>
              <CommandItem onSelect={() => go("/reminders")}><BellRing className="size-4 mr-2" /> Reminders</CommandItem>
              <CommandItem onSelect={() => go("/analytics")}><BarChart3 className="size-4 mr-2" /> Analytics</CommandItem>
              <CommandItem onSelect={() => go("/imports")}><Upload className="size-4 mr-2" /> Import Patients</CommandItem>
              <CommandItem onSelect={() => go("/exports")}><Download className="size-4 mr-2" /> Export Center</CommandItem>
            </CommandGroup>
            {results.length > 0 && (
              <CommandGroup heading="Patients">
                {results.map((p) => {
                  const name = patientDisplayName(p);
                  return (
                    <CommandItem key={p.id} value={p.id} onSelect={() => go("/patients/$patientId", { patientId: p.id })}>
                      <span className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] mr-2">
                        {name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                      </span>
                      {name}
                      {p.reg_no != null && (
                        <span className="ml-auto text-xs text-muted-foreground font-mono">
                          VNC-{String(p.reg_no).padStart(4, "0")}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
