// Allopathy doctor — extra clinical context per patient + prescription helpers

export type Vitals = {
  bp: string;
  pulse: number;
  temp: string;
  spo2: number;
  weight: string;
  height: string;
};

export type ClinicalRecord = {
  patient_id: string;
  chief_complaint: string;
  duration: string;
  vitals: Vitals;
  allergies: string[];
  chronic: string[];
  current_meds: string[];
  last_visit_summary?: string;
  history: { date: string; complaint: string; rx: string }[];
};

export const clinicalRecords: Record<string, ClinicalRecord> = {
  p1: {
    patient_id: "p1",
    chief_complaint: "Headache & disturbed sleep",
    duration: "5 days",
    vitals: { bp: "118/76", pulse: 72, temp: "98.4°F", spo2: 98, weight: "58 kg", height: "162 cm" },
    allergies: ["Sulfa drugs"],
    chronic: ["Migraine"],
    current_meds: ["Vitamin D3 weekly"],
    last_visit_summary: "Started Naproxen SOS — partial relief reported.",
    history: [
      { date: "2026-05-10", complaint: "Migraine flare", rx: "Naproxen 250mg BD × 3d" },
      { date: "2026-04-22", complaint: "Routine review", rx: "Vit D3 60K weekly" },
      { date: "2026-03-04", complaint: "Insomnia", rx: "Sleep hygiene advice" },
    ],
  },
  p2: {
    patient_id: "p2",
    chief_complaint: "Diabetes review — fasting sugar high",
    duration: "2 weeks",
    vitals: { bp: "138/86", pulse: 78, temp: "98.6°F", spo2: 97, weight: "76 kg", height: "170 cm" },
    allergies: [],
    chronic: ["Type 2 Diabetes", "Hypertension"],
    current_meds: ["Metformin 500mg BD", "Telmisartan 40mg OD"],
    last_visit_summary: "HbA1c 7.8 — advised diet & increased Metformin.",
    history: [
      { date: "2026-05-09", complaint: "Diabetes review", rx: "Metformin 500mg BD" },
      { date: "2026-04-02", complaint: "BP check", rx: "Telmisartan 40mg OD" },
    ],
  },
  p3: {
    patient_id: "p3",
    chief_complaint: "Skin rash & itching on forearms",
    duration: "3 days",
    vitals: { bp: "112/72", pulse: 70, temp: "98.2°F", spo2: 99, weight: "54 kg", height: "160 cm" },
    allergies: ["Penicillin"],
    chronic: [],
    current_meds: [],
    history: [{ date: "2026-05-06", complaint: "Cold", rx: "Levocetirizine 5mg HS × 5d" }],
  },
  p4: {
    patient_id: "p4",
    chief_complaint: "Chest discomfort on exertion",
    duration: "4 days",
    vitals: { bp: "146/92", pulse: 84, temp: "98.4°F", spo2: 96, weight: "82 kg", height: "172 cm" },
    allergies: [],
    chronic: ["Hypertension", "Hyperlipidemia"],
    current_meds: ["Amlodipine 5mg OD", "Atorvastatin 20mg HS"],
    last_visit_summary: "ECG normal — advised stress test.",
    history: [
      { date: "2026-05-04", complaint: "BP review", rx: "Amlodipine continued" },
      { date: "2026-04-01", complaint: "Lipid review", rx: "Atorvastatin 20mg HS" },
    ],
  },
  p5: {
    patient_id: "p5",
    chief_complaint: "Sore throat with mild fever",
    duration: "2 days",
    vitals: { bp: "116/74", pulse: 88, temp: "100.1°F", spo2: 98, weight: "62 kg", height: "165 cm" },
    allergies: [],
    chronic: [],
    current_meds: [],
    history: [{ date: "2026-04-27", complaint: "Allergy", rx: "Cetirizine 10mg HS × 7d" }],
  },
  p8: {
    patient_id: "p8",
    chief_complaint: "Mild fever, runny nose (paediatric)",
    duration: "1 day",
    vitals: { bp: "100/64", pulse: 102, temp: "100.4°F", spo2: 98, weight: "22 kg", height: "118 cm" },
    allergies: [],
    chronic: [],
    current_meds: [],
    history: [{ date: "2026-05-04", complaint: "Cough", rx: "Paracetamol syrup SOS" }],
  },
};

export function getClinical(patientId: string): ClinicalRecord {
  return (
    clinicalRecords[patientId] ?? {
      patient_id: patientId,
      chief_complaint: "—",
      duration: "—",
      vitals: { bp: "—", pulse: 0, temp: "—", spo2: 0, weight: "—", height: "—" },
      allergies: [],
      chronic: [],
      current_meds: [],
      history: [],
    }
  );
}

// ----- Prescription -----

export type Frequency = "OD" | "BD" | "TDS" | "QID" | "HS" | "SOS";

export const frequencyLabel: Record<Frequency, string> = {
  OD: "Once daily",
  BD: "Twice daily",
  TDS: "Thrice daily",
  QID: "Four times",
  HS: "At bedtime",
  SOS: "When needed",
};

export type RxLine = {
  id: string;
  drug: string;
  dose: string;
  frequency: Frequency;
  duration_days: number;
  notes?: string;
};

export const commonDrugs = [
  { drug: "Paracetamol 500mg", dose: "1 tab", frequency: "TDS" as Frequency, duration_days: 3 },
  { drug: "Azithromycin 500mg", dose: "1 tab", frequency: "OD" as Frequency, duration_days: 5 },
  { drug: "Pantoprazole 40mg", dose: "1 tab", frequency: "OD" as Frequency, duration_days: 7 },
  { drug: "Cetirizine 10mg", dose: "1 tab", frequency: "HS" as Frequency, duration_days: 5 },
  { drug: "Amoxicillin 500mg", dose: "1 cap", frequency: "TDS" as Frequency, duration_days: 5 },
  { drug: "Metformin 500mg", dose: "1 tab", frequency: "BD" as Frequency, duration_days: 30 },
  { drug: "Amlodipine 5mg", dose: "1 tab", frequency: "OD" as Frequency, duration_days: 30 },
  { drug: "Naproxen 250mg", dose: "1 tab", frequency: "BD" as Frequency, duration_days: 3 },
  { drug: "ORS sachet", dose: "1 sachet", frequency: "SOS" as Frequency, duration_days: 3 },
];
