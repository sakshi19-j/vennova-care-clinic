# Final Production Launch Pass — Execution Plan

This is a very large pass (10 interlinked systems). To deliver it reliably without breaking the working Railway + Supabase + WhatsApp stack, I'll execute it as **one coordinated pass** broken into **3 sequential commits** in a single session. Each commit is independently safe to deploy, but together they constitute the full launch.

I will **not** stop between commits for approval — you've asked for a single coordinated pass. I'll only stop if I hit a blocker that requires your input (missing Razorpay plan IDs, storage bucket policy, etc.).

---

## Commit 1 — Queue lifecycle, mock data removal, patient workspace (read-only)

**Queue (highest risk, done first):**
- Hard-enforce 4 canonical statuses everywhere via `normalizeQueueStatus`
- After prescription save → optimistic `setQueryData` removes patient from doctor queue + transitions to `BILLING_PENDING` via existing `/queue/{id}/status` endpoint
- After payment → optimistic remove from billing queue + transition to `COMPLETED`
- Filters: doctor queues = `WAITING|IN_TREATMENT` only; reception active = `WAITING`; billing = `BILLING_PENDING`; completed never appears in any active list
- Replace polling intervals with `refetchOnWindowFocus` + 15s background refetch (no race storms)
- Centralized mutation helpers in `queue-store.ts` so every caller transitions identically

**Mock data sweep:**
- Audit & wire: `admin.index`, `admin.staff`, `doctor.index`, `homeopathy.index`, `reception.index`, `reception.followups`, `billing.tsx`, `prescriptions.tsx`, `appointments.tsx`
- All charts → real `/analytics/*` endpoints with proper loading/empty/error states
- Wait times from `created_at` only (already done in `wait-time.ts`)

**Patient Workspace:**
- New route `/patients/$patientId/workspace` with tabs: Summary, Visits, Prescriptions, Case Papers, Billing, Follow-ups, Notes, Attachments, AI Insights
- Doctor patient search + completed-consultation links → workspace (not consultation editor)
- Consultation route guards: only opens for visits with status `IN_TREATMENT` or `WAITING`; completed redirects to workspace
- Read-only renderer for past prescriptions/visits

---

## Commit 2 — Consultation editor, Settings persistence + branding, Prescription PDF v2, Follow-ups

**Consultation editor:**
- Section model: `{id, title, type, content, order}` stored per-visit; templates stored per-doctor in new `consultation_templates` Supabase table
- Add/remove/reorder (drag handles) + "Save as template" / "Load template"
- Preserves existing homeopathy fields (miasm, modalities, etc.) as a built-in template

**Settings + branding:**
- Wire every Save button to backend `/settings/*` endpoints
- New Supabase Storage buckets: `clinic-branding` (private, signed URLs) for logos + signatures
- Branding context propagates to: PDF generator, receipts, prescription preview, app header
- Live preview panel in branding settings

**Prescription PDF v2:**
- Rewrite `jspdf` template: logo header, clinic name/address, doctor block, patient block, Rx body, signature image, footer
- Two variants: `allopathy` (standard table) + `homeopathy` (potency/repetition columns)
- Fix "Preview PDF" + "Save Template" buttons

**Follow-up lifecycle:**
- Auto-create follow-up row on visit COMPLETED (backend already supports; ensure frontend triggers it)
- Reminder list pulls from `/reminders/today` (already exists)
- WhatsApp send button → `/reminders/{id}/send` with optimistic state update

---

## Commit 3 — Subscriptions + Razorpay, bulk import, final UX polish

**Subscriptions:**
- 3 plans (Starter/Growth/Clinic Pro) with monthly/yearly toggle
- Plan state from `/subscription/current`; checkout via existing Razorpay flow (`VITE_RAZORPAY_KEY_ID`)
- Feature gates via `useSubscription()` hook (`canUseFeature("ai_insights")` etc.)
- Current plan badge in admin sidebar; renewal banner when <7 days

**Bulk import:**
- New `/reception/patients/import` route
- CSV/XLSX parser via `papaparse` + `xlsx` (added as deps)
- Column mapping UI, phone-based dedup preview, batch POST to `/patients/bulk`
- Falls back to row-by-row `/patients` POST if `/patients/bulk` 404s

**Final polish:**
- Skeleton loaders on all data tables
- Empty states with CTAs
- Toast on every mutation success/error
- Fix any broken nav links surfaced during the pass

---

## Questions before I start

1. **Razorpay plan IDs** — are `plan_starter`, `plan_growth`, `plan_clinicpro` already provisioned on the backend (monthly + yearly variants), or should I stub the IDs and you'll fill them via env later?
2. **Storage bucket** — OK to create one private bucket `clinic-branding` for logos + signatures (signed URLs)? Or do you want separate `clinic-logos` and `clinic-signatures`?
3. **Bulk import endpoint** — does the Railway backend expose `POST /patients/bulk`, or should I assume per-row `POST /patients`?

Answer these 3 and I'll execute all 3 commits in one continuous pass. If you say "just proceed", I'll use sensible defaults (stub plan IDs, single `clinic-branding` bucket, per-row import fallback) and ship.
