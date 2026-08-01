// Shared BOX-style medicine builder — used on both the consultation page and
// the prescription page so a doctor never re-enters the same Rx twice.
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BoxItem = {
  box: string;
  remedy: string;
  potency: string;
  timing: string;
  food: "Before food" | "After food" | "With food" | "";
  days: string;
};

export const POTENCIES = ["6C", "30C", "200C", "1M", "10M", "CM", "SL", "PL", "Rubrum"];
export const TIMINGS = ["OD", "BD", "TDS", "QID", "HS", "SOS"];
export const FOOD_OPTIONS = ["Before food", "After food", "With food"] as const;

export const newBox = (index: number): BoxItem => ({
  box: String(index),
  remedy: "",
  potency: "30C",
  timing: "BD",
  food: "After food",
  days: "7",
});

type AnyMedicine = Record<string, unknown>;

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Map backend `medicines` rows onto BOX rows. */
export function boxesFromMedicines(meds: unknown): BoxItem[] {
  if (!Array.isArray(meds) || meds.length === 0) return [];
  return meds.map((raw, i) => {
    const m = (raw ?? {}) as AnyMedicine;
    const food = s(m.food_relation ?? m.food);
    return {
      box: s(m.box ?? m.box_no ?? i + 1) || String(i + 1),
      remedy: s(m.name ?? m.remedy),
      potency: s(m.potency ?? m.dosage) || "30C",
      timing: s(m.timing ?? m.frequency) || "BD",
      food: (FOOD_OPTIONS as readonly string[]).includes(food)
        ? (food as BoxItem["food"])
        : "",
      days: s(m.days ?? m.duration ?? m.duration_days),
    };
  });
}

/** Payload shape expected by POST /visits/{id}/medicines. */
export function medicinesPayload(boxes: BoxItem[]) {
  return boxes
    .filter((b) => b.remedy.trim())
    .map((b) => ({
      name: b.remedy.trim(),
      potency: b.potency,
      timing: b.timing,
      days: b.days,
      food_relation: b.food || "",
    }));
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{children}</div>;
}

export function MedicineBoxes({
  boxes,
  setBoxes,
}: {
  boxes: BoxItem[];
  setBoxes: (updater: (prev: BoxItem[]) => BoxItem[]) => void;
}) {
  const addBox = () => setBoxes((b) => [...b, newBox(b.length + 1)]);
  const removeBox = (i: number) => setBoxes((b) => b.filter((_, idx) => idx !== i));
  const setBox = (i: number, field: keyof BoxItem, v: string) =>
    setBoxes((b) => b.map((x, idx) => (idx === i ? { ...x, [field]: v } : x)));

  return (
    <div>
      <div className="space-y-3">
        {boxes.map((b, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6 md:col-span-2">
                <Label>BOX #</Label>
                <input
                  value={b.box}
                  onChange={(e) => setBox(i, "box", e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label>Remedy</Label>
                <input
                  value={b.remedy}
                  onChange={(e) => setBox(i, "remedy", e.target.value)}
                  placeholder="e.g. Pulsatilla"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label>Potency</Label>
                <select
                  value={b.potency}
                  onChange={(e) => setBox(i, "potency", e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {POTENCIES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label>Timing</Label>
                <select
                  value={b.timing}
                  onChange={(e) => setBox(i, "timing", e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {TIMINGS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label>Days</Label>
                <input
                  type="number"
                  value={b.days}
                  onChange={(e) => setBox(i, "days", e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="col-span-11">
                <Label>Food</Label>
                <div className="flex gap-2 flex-wrap">
                  {FOOD_OPTIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setBox(i, "food", b.food === f ? "" : f)}
                      className={`h-8 px-3 rounded-full border text-xs ${
                        b.food === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-1 flex items-end justify-end">
                {boxes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBox(i)}
                    aria-label="Remove BOX"
                    className="size-9 grid place-items-center rounded-lg border border-border hover:bg-muted text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" className="rounded-full mt-3" onClick={addBox}>
        <Plus className="size-4 mr-1" /> Add BOX
      </Button>
    </div>
  );
}
