import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download, FileSpreadsheet, FileText, Search, Users, ListOrdered,
  Stethoscope, Receipt, ChevronDown,
} from "lucide-react";
// jsPDF + autoTable are loaded on demand so their ~150 KB bundle only
// downloads when the admin actually exports a PDF.
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useQueue } from "@/lib/queue-store";
import { queueStatusStyles, formatTime } from "@/lib/reception-data";
import { patientsService, patientDisplayName, patientPhone } from "@/services/patients";
import { dashboardService } from "@/services/dashboard";
import { billingService, billingAmount, billingPatientName } from "@/services/billing";

// ---------- CSV helpers ----------
function toCSV(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function downloadPDF(title: string, head: string[], body: (string | number)[][]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16); doc.text(title, 40, 40);
  doc.setFontSize(10); doc.setTextColor(120);
  doc.text(new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }), 40, 58);
  autoTable(doc, {
    startY: 80, head: [head], body,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30] },
    theme: "grid",
  });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---------- toolbar ----------
export function AdminToolbar() {
  const queue = useQueue();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live patient search (server-side). Opens only while modal is active.
  const patientsQ = useQuery({
    queryKey: ["admin-search", "patients", query],
    queryFn: () => patientsService.list({ search: query || undefined, limit: 8 }),
    enabled: searchOpen && query.trim().length > 0,
    staleTime: 15_000,
  });

  // ---------- exports (fetch fresh from backend on click) ----------
  const exportQueueCSV = () => {
    const rows = queue.map((q) => ({
      token: q.token_number,
      patient: q.patient_name,
      phone: q.patient_phone,
      visit_type: q.visit_type,
      priority: q.priority === 1 ? "PRIORITY" : "Normal",
      status: q.status,
      wait_min: q.wait_minutes,
      notes: q.notes ?? "",
    }));
    download(`queue-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
  };
  const exportQueuePDF = () => {
    downloadPDF(
      "Daily Queue Report",
      ["Token", "Patient", "Phone", "Visit", "Priority", "Status", "Wait (m)", "Notes"],
      queue.map((q) => [
        `#${q.token_number}`, q.patient_name, q.patient_phone, q.visit_type,
        q.priority === 1 ? "Priority" : "—",
        queueStatusStyles[q.status].label, q.wait_minutes, q.notes ?? "",
      ]),
    );
  };
  const exportApptCSV = async () => {
    const appts = await dashboardService.appointmentsToday();
    const rows = appts.map((a: any) => ({
      time: a.scheduled_at ? formatTime(a.scheduled_at) : "",
      patient: a.patient_name ?? "",
      phone: a.patient_phone ?? "",
      type: a.visit_type ?? "",
      complaint: a.chief_complaint ?? "",
      duration_min: a.duration_mins ?? "",
      status: a.status ?? "",
    }));
    download(`appointments-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
  };
  const exportApptPDF = async () => {
    const appts = await dashboardService.appointmentsToday();
    downloadPDF(
      "Daily Appointments Report",
      ["Time", "Patient", "Phone", "Type", "Complaint", "Duration", "Status"],
      appts.map((a: any) => [
        a.scheduled_at ? formatTime(a.scheduled_at) : "—",
        a.patient_name ?? "—", a.patient_phone ?? "—", a.visit_type ?? "—",
        a.chief_complaint ?? "—", a.duration_mins ? `${a.duration_mins}m` : "—", a.status ?? "—",
      ]),
    );
  };
  const exportCollectionsCSV = async () => {
    const [summary, pending] = await Promise.all([
      dashboardService.summaryToday(),
      billingService.pending(),
    ]);
    const s: any = summary || {};
    const rev = s.revenue_today ?? s.total ?? 0;
    const rows = [
      { metric: "Total revenue today", amount: rev, count: s.visits_today ?? "" },
      ...pending.map((b) => ({
        metric: `Pending — ${billingPatientName(b)} (${b.visit_id ?? b.id ?? ""})`,
        amount: billingAmount(b),
        count: b.doctor_name ?? "",
      })),
    ];
    download(`collections-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
  };
  const exportCollectionsPDF = async () => {
    const [summary, pending] = await Promise.all([
      dashboardService.summaryToday(),
      billingService.pending(),
    ]);
    const s: any = summary || {};
    const rev = Number(s.revenue_today ?? s.total ?? 0);
    downloadPDF(
      "Daily Collections Report",
      ["Item", "Amount (₹)", "Detail"],
      [
        ["Total collected today", rev.toLocaleString("en-IN"), `${s.visits_today ?? 0} visits`],
        ["—— Pending bills ——", "", ""],
        ...pending.map((b) => [
          `${billingPatientName(b)} · ${b.visit_id ?? b.id ?? ""}`,
          billingAmount(b).toLocaleString("en-IN"),
          `${b.doctor_name ?? "—"} · ${b.visit_type ?? "—"}`,
        ]),
      ],
    );
  };

  // ---------- global search ----------
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { patients: [], queue: [] };
    const match = (s: string) => s.toLowerCase().includes(q);
    return {
      patients: patientsQ.data?.items ?? [],
      queue: queue.filter((x) =>
        match(x.patient_name) || match(String(x.token_number)) || match(x.queue_id) || match(x.notes ?? ""),
      ).slice(0, 6),
    };
  }, [query, queue, patientsQ.data]);

  const go = (to: string) => { setSearchOpen(false); navigate({ to } as any); };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSearchOpen(true)}
        className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition min-w-[260px]"
      >
        <Search className="size-4" />
        <span>Search patients &amp; queue…</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-border bg-background">⌘/</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-90">
            <Download className="size-4" /> Export <ChevronDown className="size-3.5 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Daily queue</DropdownMenuLabel>
          <DropdownMenuItem onClick={exportQueueCSV}><FileSpreadsheet className="size-4 mr-2" /> Download CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={exportQueuePDF}><FileText className="size-4 mr-2" /> Download PDF</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Appointments</DropdownMenuLabel>
          <DropdownMenuItem onClick={exportApptCSV}><FileSpreadsheet className="size-4 mr-2" /> Download CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={exportApptPDF}><FileText className="size-4 mr-2" /> Download PDF</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Collections</DropdownMenuLabel>
          <DropdownMenuItem onClick={exportCollectionsCSV}><FileSpreadsheet className="size-4 mr-2" /> Download CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={exportCollectionsPDF}><FileText className="size-4 mr-2" /> Download PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="p-0 max-w-2xl overflow-hidden">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search patients by name, phone, reg no…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-[420px]">
              {query && !patientsQ.isLoading && results.patients.length === 0 && results.queue.length === 0 && (
                <CommandEmpty>No results.</CommandEmpty>
              )}
              {!query && (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Search across <strong>patients</strong> and the <strong>live queue</strong>.
                </div>
              )}

              {results.queue.length > 0 && (
                <CommandGroup heading="Live queue">
                  {results.queue.map((q) => (
                    <CommandItem key={q.queue_id} onSelect={() => go("/admin/monitor")}>
                      <ListOrdered className="size-4 mr-2 text-amber-600" />
                      <span className="font-medium">#{q.token_number} · {q.patient_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{queueStatusStyles[q.status].label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{q.wait_minutes}m wait</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results.patients.length > 0 && (
                <CommandGroup heading="Patients">
                  {results.patients.map((p) => (
                    <CommandItem key={p.id} onSelect={() => go(`/doctor/patients/${p.id}`)}>
                      <Users className="size-4 mr-2 text-primary" />
                      <span className="font-medium">{patientDisplayName(p)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.reg_no ? `VNC-${String(p.reg_no).padStart(4, "0")}` : ""}
                        {patientPhone(p) ? ` · ${patientPhone(p)}` : ""}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* keep icon imports referenced */}
      <span className="hidden">
        <Stethoscope /><Receipt />
      </span>
    </div>
  );
}

// Silence unused-import warnings when tree-shaking removes a Link reference.
export const _ensureLink = Link;
