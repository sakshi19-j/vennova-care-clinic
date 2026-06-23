// Single source of truth for "X waiting" labels in queue UIs.
// Caps absurdly large values (clock drift, day-old WAITING rows) and
// reports tiny values as "Just added" per the launch spec.

export function formatWaitMinutes(minutes: number | undefined | null, createdAtIso?: string | null): string {
  let m = Number(minutes);
  if (!Number.isFinite(m) || m < 0) m = 0;
  // Prefer client-side calc from created_at when available; backend may have
  // computed wait_minutes on row creation and never refreshed it.
  if (createdAtIso) {
    const t = new Date(createdAtIso).getTime();
    if (Number.isFinite(t)) {
      const live = Math.floor((Date.now() - t) / 60000);
      if (live >= 0) m = live;
    }
  }
  if (m < 1) return "Just added";
  if (m >= 480) return "8h+ waiting";
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h waiting` : `${h}h ${rem}m waiting`;
  }
  return `${m}m waiting`;
}