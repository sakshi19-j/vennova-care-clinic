// Homeopathy doctor — case-taking, repertorization & remedy prescription helpers

export type Potency = "6C" | "30C" | "200C" | "1M" | "10M" | "Q" | "3X" | "6X" | "30X";
export type RemedyForm = "Globules" | "Drops" | "Liquid Dilution" | "Tablets" | "Mother Tincture";
export type Repetition = "Single Dose" | "OD" | "BD" | "TDS" | "Weekly" | "SOS" | "Stat";

export type Modalities = {
  better_from: string[];
  worse_from: string[];
};

export type CaseRecord = {
  patient_id: string;
  chief_complaint: string;
  duration: string;
  // Constitutional / miasmatic context
  constitution?: string;          // e.g. "Phosphoric — tall, sensitive, anxious"
  miasm?: "Psoric" | "Sycotic" | "Syphilitic" | "Tubercular" | "Mixed";
  thermal?: "Hot" | "Chilly" | "Ambithermal";
  // Mind & generals
  mental_state?: string;
  desires?: string[];
  aversions?: string[];
  sleep?: string;
  thirst?: string;
  appetite?: string;
  modalities: Modalities;
  // Vitals (lighter — recorded by reception)
  vitals: { bp: string; pulse: number; temp: string; weight: string };
  allergies: string[];
  history: { date: string; complaint: string; remedy: string }[];
  last_visit_summary?: string;
};

export const caseRecords: Record<string, CaseRecord> = {
  p1: {
    patient_id: "p1",
    chief_complaint: "Chronic anxiety with disturbed sleep & migraine",
    duration: "6 months",
    constitution: "Phosphoric — sensitive, sympathetic, fear of being alone",
    miasm: "Psoric",
    thermal: "Chilly",
    mental_state: "Anxious anticipation, weeps when consoled, fear of dark",
    desires: ["Cold drinks", "Sweets", "Salt"],
    aversions: ["Fatty food"],
    sleep: "Wakes 2–4 AM, restless dreams",
    thirst: "Increased — cold water",
    appetite: "Reduced before episodes",
    modalities: {
      better_from: ["Open air", "Lying on right side", "Cold applications"],
      worse_from: ["Evening", "Warm room", "Mental exertion", "Before menses"],
    },
    vitals: { bp: "118/76", pulse: 72, temp: "98.4°F", weight: "58 kg" },
    allergies: ["Sulfa drugs"],
    last_visit_summary: "Pulsatilla 200 single dose — sleep improved, episodes ↓ 60%.",
    history: [
      { date: "2026-05-10", complaint: "Migraine flare", remedy: "Pulsatilla 200 — single dose" },
      { date: "2026-04-12", complaint: "Anxiety + insomnia", remedy: "Ignatia 30 BD × 7d" },
      { date: "2026-03-04", complaint: "Constitutional follow-up", remedy: "Wait & watch" },
    ],
  },
  p3: {
    patient_id: "p3",
    chief_complaint: "Itchy urticarial rash on forearms, worse warmth",
    duration: "3 days",
    constitution: "Sulphur — warm, untidy, philosophical",
    miasm: "Psoric",
    thermal: "Hot",
    mental_state: "Irritable, theorizing, lazy mornings",
    desires: ["Sweets", "Spicy food"],
    aversions: ["Eggs"],
    sleep: "Cat-naps; uncovers feet at night",
    thirst: "Marked thirst for cold drinks",
    appetite: "Good — empty 11 AM hunger",
    modalities: {
      better_from: ["Open cool air", "Dry weather"],
      worse_from: ["Warmth of bed", "Bathing", "11 AM"],
    },
    vitals: { bp: "112/72", pulse: 70, temp: "98.2°F", weight: "54 kg" },
    allergies: ["Penicillin"],
    history: [{ date: "2026-05-06", complaint: "Cold + sneezing", remedy: "Allium Cepa 30 TDS × 3d" }],
  },
  p5: {
    patient_id: "p5",
    chief_complaint: "Sore throat with low-grade fever",
    duration: "2 days",
    constitution: "Belladonna acute type — sudden onset, flushed",
    thermal: "Hot",
    mental_state: "Drowsy yet restless",
    desires: ["Lemonade"],
    aversions: [],
    sleep: "Disturbed by heat",
    thirst: "Wants small sips often",
    appetite: "Reduced",
    modalities: { better_from: ["Sitting upright", "Warm room"], worse_from: ["Touch", "Jar", "Light"] },
    vitals: { bp: "116/74", pulse: 88, temp: "100.1°F", weight: "62 kg" },
    allergies: [],
    history: [{ date: "2026-04-27", complaint: "Allergic rhinitis", remedy: "Sabadilla 30 TDS × 5d" }],
  },
  p7: {
    patient_id: "p7",
    chief_complaint: "Migraine review — left-sided, with nausea",
    duration: "Chronic, last flare 2w ago",
    constitution: "Natrum Mur — reserved, dwells on past grief",
    miasm: "Psoric",
    thermal: "Chilly",
    mental_state: "Reserved; consolation aggravates; weeps alone",
    desires: ["Salt", "Bread"],
    aversions: ["Slimy food"],
    sleep: "Light, unrefreshing",
    thirst: "Large quantities at long intervals",
    appetite: "Variable",
    modalities: { better_from: ["Open air", "Cool bathing"], worse_from: ["Sun", "10–11 AM", "Sea-shore"] },
    vitals: { bp: "120/80", pulse: 74, temp: "98.6°F", weight: "55 kg" },
    allergies: [],
    last_visit_summary: "Natrum Mur 1M single dose — frequency ↓ from 4 → 1/month.",
    history: [
      { date: "2026-04-10", complaint: "Migraine flare", remedy: "Natrum Mur 1M — single dose" },
      { date: "2026-02-28", complaint: "Grief + headache", remedy: "Ignatia 200 single dose" },
    ],
  },
  p8: {
    patient_id: "p8",
    chief_complaint: "Mild fever with runny nose (paediatric)",
    duration: "1 day",
    constitution: "Calc Carb child — mild, plump, sweats on head",
    thermal: "Chilly",
    mental_state: "Clingy, fearful of strangers today",
    desires: ["Eggs", "Indigestible things"],
    aversions: ["Milk"],
    sleep: "Sweats on scalp during sleep",
    thirst: "Increased",
    appetite: "Reduced today",
    modalities: { better_from: ["Lying down", "Dry weather"], worse_from: ["Cold air", "Wet weather", "Teething"] },
    vitals: { bp: "100/64", pulse: 102, temp: "100.4°F", weight: "22 kg" },
    allergies: [],
    history: [{ date: "2026-05-04", complaint: "Cough", remedy: "Aconite 30 SOS" }],
  },
  p9: {
    patient_id: "p9",
    chief_complaint: "Joint stiffness on rising, better motion",
    duration: "Chronic — 3 years",
    constitution: "Rhus Tox type — restless, aggravated rest",
    miasm: "Sycotic",
    thermal: "Chilly",
    mental_state: "Restless, anxious at night, weeps without cause",
    desires: ["Cold milk"],
    aversions: ["Meat"],
    sleep: "Restless, frequent position change",
    thirst: "Normal",
    appetite: "Good",
    modalities: { better_from: ["Continued motion", "Warm applications"], worse_from: ["Initial motion", "Damp cold", "Rest"] },
    vitals: { bp: "130/82", pulse: 76, temp: "98.4°F", weight: "64 kg" },
    allergies: [],
    history: [{ date: "2026-03-21", complaint: "Joint pain flare", remedy: "Rhus Tox 200 BD × 5d" }],
  },
};

export function getCase(patientId: string): CaseRecord {
  return (
    caseRecords[patientId] ?? {
      patient_id: patientId,
      chief_complaint: "—",
      duration: "—",
      modalities: { better_from: [], worse_from: [] },
      vitals: { bp: "—", pulse: 0, temp: "—", weight: "—" },
      allergies: [],
      history: [],
    }
  );
}

// ---------- Prescription ----------

export type RemedyLine = {
  id: string;
  remedy: string;
  potency: Potency;
  form: RemedyForm;
  dose: string;          // e.g. "4 globules" / "5 drops in 1 tsp water"
  repetition: Repetition;
  duration_days: number; // 0 = single dose
  notes?: string;
};

export const potencies: Potency[] = ["6X", "30X", "6C", "30C", "200C", "1M", "10M", "Q", "3X"];
export const forms: RemedyForm[] = ["Globules", "Drops", "Liquid Dilution", "Tablets", "Mother Tincture"];
export const repetitions: Repetition[] = ["Single Dose", "Stat", "OD", "BD", "TDS", "Weekly", "SOS"];

export const repetitionLabel: Record<Repetition, string> = {
  "Single Dose": "Single dose only",
  Stat: "Once now",
  OD: "Once daily",
  BD: "Twice daily",
  TDS: "Thrice daily",
  Weekly: "Once a week",
  SOS: "When needed",
};

// Common acute & constitutional remedies for one-tap prescription
export const commonRemedies: { remedy: string; potency: Potency; form: RemedyForm; dose: string; repetition: Repetition; duration_days: number; hint: string }[] = [
  { remedy: "Arnica Montana", potency: "200C", form: "Globules", dose: "4 globules", repetition: "TDS", duration_days: 3, hint: "Trauma, soreness, bruising" },
  { remedy: "Aconite Napellus", potency: "30C", form: "Globules", dose: "4 globules", repetition: "SOS", duration_days: 2, hint: "Sudden onset, fright, exposure to cold" },
  { remedy: "Belladonna", potency: "30C", form: "Globules", dose: "4 globules", repetition: "TDS", duration_days: 3, hint: "Hot, red, throbbing — sudden" },
  { remedy: "Nux Vomica", potency: "30C", form: "Globules", dose: "4 globules", repetition: "BD", duration_days: 5, hint: "Indigestion, irritability, sedentary" },
  { remedy: "Pulsatilla", potency: "200C", form: "Globules", dose: "Single dose", repetition: "Single Dose", duration_days: 0, hint: "Mild, weepy, changeable, thirstless" },
  { remedy: "Bryonia Alba", potency: "30C", form: "Globules", dose: "4 globules", repetition: "TDS", duration_days: 3, hint: "Worse from any motion, dry mucosa" },
  { remedy: "Rhus Toxicodendron", potency: "200C", form: "Globules", dose: "4 globules", repetition: "BD", duration_days: 5, hint: "Better continued motion, joint stiffness" },
  { remedy: "Sulphur", potency: "200C", form: "Globules", dose: "Single dose", repetition: "Single Dose", duration_days: 0, hint: "Hot, untidy, skin issues, philosopher" },
  { remedy: "Natrum Muriaticum", potency: "1M", form: "Globules", dose: "Single dose", repetition: "Single Dose", duration_days: 0, hint: "Reserved, grief, salt craving" },
  { remedy: "Ignatia Amara", potency: "200C", form: "Globules", dose: "4 globules", repetition: "BD", duration_days: 5, hint: "Acute grief, sighing, contradictory" },
  { remedy: "Calcarea Carbonica", potency: "200C", form: "Globules", dose: "Single dose", repetition: "Single Dose", duration_days: 0, hint: "Plump child, head sweats, slow milestones" },
  { remedy: "Allium Cepa", potency: "30C", form: "Globules", dose: "4 globules", repetition: "TDS", duration_days: 3, hint: "Coryza, watery eyes, bland nasal" },
];

// Common modality chips for quick case-taking
export const modalityChips = {
  better: ["Open air", "Warm applications", "Cold applications", "Lying down", "Motion", "Rest", "Pressure", "Sleep"],
  worse: ["Cold air", "Heat", "Damp weather", "Night", "Morning", "After eating", "Touch", "Mental exertion"],
};
