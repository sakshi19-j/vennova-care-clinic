import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localIsoDate } from "@/lib/appointments";

export type CalendarMode = "month" | "week" | "day";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Compact clinic calendar with month / week / day modes. */
export function AppointmentCalendar({
  mode,
  onModeChange,
  selectedDate,
  onSelectDate,
  countsByDate,
  closedDates,
}: {
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  countsByDate: Record<string, number>;
  closedDates?: (iso: string) => boolean;
}) {
  const today = localIsoDate();
  const selected = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);

  const days = useMemo(() => {
    if (mode === "day") return [selected];
    if (mode === "week") {
      const s = startOfWeek(selected);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [mode, selected]);

  const shift = (dir: number) => {
    const step = mode === "day" ? 1 : mode === "week" ? 7 : 0;
    if (step) {
      onSelectDate(localIsoDate(addDays(selected, dir * step)));
    } else {
      const d = new Date(selected.getFullYear(), selected.getMonth() + dir, 1);
      onSelectDate(localIsoDate(d));
    }
  };

  const heading =
    mode === "day"
      ? selected.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
      : mode === "week"
        ? `Week of ${startOfWeek(selected).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : selected.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => shift(-1)}
          aria-label="Previous"
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{heading}</div>
        <button
          onClick={() => shift(1)}
          aria-label="Next"
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["month", "week", "day"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={[
                "h-8 px-2.5 text-xs font-medium capitalize",
                mode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSelectDate(today)}
          className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Today
        </button>
      </div>

      {mode !== "day" && (
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      )}

      <div className={mode === "day" ? "mt-3" : "mt-1 grid grid-cols-7 gap-1"}>
        {days.map((d) => {
          const iso = localIsoDate(d);
          const inMonth = mode !== "month" || d.getMonth() === selected.getMonth();
          const count = countsByDate[iso] ?? 0;
          const closed = closedDates?.(iso) ?? false;
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              onClick={() => onSelectDate(iso)}
              className={[
                "relative rounded-lg border text-center transition-colors",
                mode === "day" ? "w-full py-4 text-sm" : "py-2 text-xs",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : closed
                    ? "border-transparent bg-muted/40 text-muted-foreground/50"
                    : inMonth
                      ? "border-transparent text-foreground hover:bg-muted"
                      : "border-transparent text-muted-foreground/40 hover:bg-muted",
                iso === today && !isSelected ? "ring-1 ring-primary/40" : "",
              ].join(" ")}
            >
              <span className="tabular-nums">
                {mode === "day"
                  ? d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
                  : d.getDate()}
              </span>
              {count > 0 && (
                <span
                  className={[
                    "mx-auto mt-0.5 block h-1 w-1 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-primary",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
