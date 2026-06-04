import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Download, FileSpreadsheet, FileText, Search, Users, ListOrdered,
  Stethoscope, Receipt, ChevronDown,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useQueue } from "@/lib/queue-store";
import {
  rxAppointments, rxPendingBills, rxPatients, rxRevenueToday,
  apptStatusStyles, queueStatusStyles, formatTime,
} from "@/lib/reception-data";
import { clinicalRecords } from "@/lib/doctor-data";

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
function downloadPDF(title: string, head: string[], body: (string | number)[][]) {
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

  // ---------- exports ----------
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
  const exportApptCSV = () => {
    const rows = rxAppointments.map((a) => ({
      time: formatTime(a.scheduled_at),
      patient: a.patient_name,
      phone: a.patient_phone,
      type: a.visit_type,
      complaint: a.chief_complaint ?? "",
      duration_min: a.duration_mins,
      status: a.status,
    }));
    download(`appointments-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
  };
  const exportApptPDF = () => {
    downloadPDF(
      "Daily Appointments Report",
      ["Time", "Patient", "Phone", "Type", "Complaint", "Duration", "Status"],
      rxAppointments.map((a) => [
        formatTime(a.scheduled_at), a.patient_name, a.patient_phone, a.visit_type,
        a.chief_complaint ?? "—", `${a.duration_mins}m`, a.status,
      ]),
    );
  };
  const exportCollectionsCSV = () => {
    const summary = [
      { metric: "Total", amount: rxRevenueToday.total, count: rxRevenueToday.count },
      { metric: "Cash", amount: rxRevenueToday.CASH, count: "" },
      { metric: "UPI", amount: rxRevenueToday.UPI, count: "" },
      { metric: "Card", amount: rxRevenueToday.CARD, count: "" },
      { metric: "Online", amount: rxRevenueToday.ONLINE, count: "" },
    ];
    const pending = rxPendingBills.map((b) => ({
      metric: `Pending — ${b.patient_name} (${b.visit_id})`,
      amount: b.suggested_fee,
      count: b.doctor_name,
    }));
    download(
      `collections-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV([...summary, ...pending]),
      "text/csv",
    );
  };
  const exportCollectionsPDF = () => {
    downloadPDF(
      "Daily Collections Report",
      ["Item", "Amount (₹)", "Detail"],
      [
        ["Total collected today", rxRevenueToday.total.toLocaleString("en-IN"), `${rxRevenueToday.count} bills`],
        ["Cash",   rxRevenueToday.CASH.toLocaleString("en-IN"),   ""],
        ["UPI",    rxRevenueToday.UPI.toLocaleString("en-IN"),    ""],
        ["Card",   rxRevenueToday.CARD.toLocaleString("en-IN"),   ""],
        ["Online", rxRevenueToday.ONLINE.toLocaleString("en-IN"), ""],
        ["—— Pending bills ——", "", ""],
        ...rxPendingBills.map((b) => [
          `${b.patient_name} · ${b.visit_id}`,
          b.suggested_fee.toLocaleString("en-IN"),
          `${b.doctor_name} · ${b.visit_type}`,
        ]),
      ],
    );
  };

  // ---------- global search ----------
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { patients: [], queue: [], visits: [], rx: [], bills: [] };
    const match = (s: string) => s.toLowerCase().includes(q);
    return {
      patients: rxPatients.filter((p) =>
        match(p.full_name) || match(p.reg_no) || match(p.phone) || match(p.city),
      ).slice(0, 6),
      queue: queue.filter((x) =>
        match(x.patient_name) || match(String(x.token_number)) || match(x.queue_id) || match(x.notes ?? ""),
      ).slice(0, 6),
      visits: rxAppointments.filter((a) =>
        match(a.patient_name) || match(a.id) || match(a.chief_complaint ?? "") || match(a.visit_type),
      ).slice(0, 6),
      rx: Object.values(clinicalRecords).filter((c) => {
        const p = rxPatients.find((pp) => pp.id === c.patient_id);
        return (
          match(c.chief_complaint) ||
          c.history.some((h) => match(h.rx) || match(h.complaint)) ||
          (p && (match(p.full_name) || match(p.reg_no)))
        );
      }).slice(0, 6),
      bills: rxPendingBills.filter((b) =>
        match(b.patient_name) || match(b.visit_id) || match(b.doctor_name) || match(b.chief_complaint),
      ).slice(0, 6),
    };
  }, [query, queue]);

  const go = (to: string) => { setSearchOpen(false); navigate({ to } as any); };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSearchOpen(true)}
        className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition min-w-[260px]"
      >
        <Search className="size-4" />
        <span>Search patients, visits, Rx, bills…</span>
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
              placeholder="Search by name, token, reg no, visit id, RX, invoice…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-[420px]">
              {query && (
                <CommandEmpty>
                  No results across queue, patients, visits, prescriptions or billing.
                </CommandEmpty>
              )}
              {!query && (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Search across <strong>queue</strong>, <strong>patients</strong>,{" "}
                  <strong>visits</strong>, <strong>prescriptions</strong> and{" "}
                  <strong>billing</strong> at once.
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
                      <span className="font-medium">{p.full_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.reg_no} · {p.phone}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">{p.patient_type}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results.visits.length > 0 && (
                <CommandGroup heading="Visits / appointments">
                  {results.visits.map((a) => (
                    <CommandItem key={a.id} onSelect={() => go("/admin/monitor")}>
                      <Stethoscope className="size-4 mr-2 text-success" />
                      <span className="font-medium">{a.patient_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{formatTime(a.scheduled_at)} · {a.visit_type}</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${apptStatusStyles[a.status]}`}>{a.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results.rx.length > 0 && (
                <CommandGroup heading="Prescriptions">
                  {results.rx.map((c) => {
                    const p = rxPatients.find((pp) => pp.id === c.patient_id);
                    return (
                      <CommandItem key={c.patient_id} onSelect={() => go(`/doctor/patients/${c.patient_id}`)}>
                        <FileText className="size-4 mr-2 text-blue-600" />
                        <span className="font-medium">{p?.full_name ?? c.patient_id}</span>
                        <span className="ml-2 text-xs text-muted-foreground truncate max-w-[260px]">{c.chief_complaint}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{c.history.length} Rx</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {results.bills.length > 0 && (
                <CommandGroup heading="Billing">
                  {results.bills.map((b) => (
                    <CommandItem key={b.visit_id} onSelect={() => go("/admin/billing")}>
                      <Receipt className="size-4 mr-2 text-violet-600" />
                      <span className="font-medium">{b.patient_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{b.visit_id} · {b.doctor_name}</span>
                      <span className="ml-auto text-sm tabular-nums">₹{b.suggested_fee.toLocaleString("en-IN")}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Silence unused-import warnings when tree-shaking removes a Link reference.
export const _ensureLink = Link;