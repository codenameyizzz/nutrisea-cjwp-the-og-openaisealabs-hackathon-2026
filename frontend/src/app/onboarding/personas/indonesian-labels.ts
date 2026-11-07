// Display translations only: API values and saved persona records stay unchanged.
const PERSONA_LABELS: Record<string, string> = {
  "The Overloaded Corporate Professional": "Profesional kantor dengan kesibukan tinggi",
  "The Preventive Health Starter": "Pemula dalam menjaga kesehatan",
  "The Budget-Conscious Fitness Enthusiast": "Penggemar kebugaran dengan anggaran terbatas",
  "The Digestive & Gentle Palate Fighter": "Pejuang kenyamanan pencernaan dengan selera rasa ringan",
  "Corporate Professional": "Karyawan kantor",
  "Management Trainee": "Peserta pelatihan manajemen",
  "Data Scientist": "Ilmuwan data",
  "Customer Success Lead": "Kepala tim keberhasilan pelanggan",
  "Corporate Communications Lead": "Kepala komunikasi perusahaan",
  "Marketing Manager": "Manajer pemasaran",
  "QA Automation Engineer": "Teknisi otomatisasi pengujian mutu",
  "Cybersecurity Analyst": "Analis keamanan siber",
  "Product Manager": "Manajer produk",
  "Account Executive": "Eksekutif pengelola klien",
  "Legal Associate": "Staf hukum",
  "Frontend Developer": "Pengembang antarmuka",
  "Software Engineer": "Pengembang perangkat lunak",
  "Supply Chain Coordinator": "Koordinator rantai pasok",
  "Junior Associate": "Staf junior",
  "Backend Engineer": "Pengembang sistem sisi server",
  "Senior Auditor": "Auditor senior",
  "Investment Banker": "Bankir investasi",
  "Branch Supervisor": "Pengawas cabang",
  "General Affairs Manager": "Manajer urusan umum",
  "Procurement Specialist": "Spesialis pengadaan",
  "Tax Consultant": "Konsultan pajak",
  "Product Designer (UI/UX)": "Perancang produk (UI/UX)",
  "Operations Lead": "Kepala operasional",
  "HR Business Partner": "Mitra bisnis sumber daya manusia",
  "Financial Analyst": "Analis keuangan",
  "Brand Strategist": "Perencana strategi merek",
  "Management Consultant": "Konsultan manajemen",
  "Scrum Master": "Fasilitator tim Scrum",
  NONE: "Tidak ada yang dilaporkan",
  HYPERTENSION_STAGE1: "Hipertensi tahap 1",
  GERD_RINGAN: "GERD ringan",
  PREDIABETES_GLUKOSA: "Pradiabetes",
  CHRONIC_GASTRITIS: "Gastritis kronis",
  BORDERLINE_CHOLESTEROL: "Kolesterol di ambang batas tinggi",
  GERD_MAAG: "GERD / maag",
};

export function personaLabel(value: string): string {
  return PERSONA_LABELS[value] ?? value;
}

export function personaRationale(value: string): string {
  return value
    .replace("kantuk/sluggishness", "kantuk atau lesu")
    .replace("food coma", "kantuk setelah makan")
    .replace("budget", "anggaran")
    .replace("capsaicin", "kapsaisin");
}
