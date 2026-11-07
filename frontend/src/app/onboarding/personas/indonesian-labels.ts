// Display labels only; saved persona values remain unchanged.
const PERSONA_LABELS: Record<string, string> = {
  "Profesional kantor dengan kesibukan tinggi": "The Overloaded Corporate Professional",
  "Pemula dalam menjaga kesehatan": "The Preventive Health Starter",
  "Penggemar kebugaran dengan anggaran terbatas": "The Budget-Conscious Fitness Enthusiast",
  "Pejuang kenyamanan pencernaan dengan selera rasa ringan": "The Digestive & Gentle Palate Fighter",
  "Karyawan kantor": "Corporate Professional",
  "Peserta pelatihan manajemen": "Management Trainee",
  "Ilmuwan data": "Data Scientist",
  "Kepala tim keberhasilan pelanggan": "Customer Success Lead",
  "Kepala komunikasi perusahaan": "Corporate Communications Lead",
  "Manajer pemasaran": "Marketing Manager",
  "Teknisi otomatisasi pengujian mutu": "QA Automation Engineer",
  "Analis keamanan siber": "Cybersecurity Analyst",
  "Manajer produk": "Product Manager",
  "Eksekutif pengelola klien": "Account Executive",
  "Staf hukum": "Legal Associate",
  "Pengembang antarmuka": "Frontend Developer",
  "Pengembang perangkat lunak": "Software Engineer",
  "Koordinator rantai pasok": "Supply Chain Coordinator",
  "Staf junior": "Junior Associate",
  "Pengembang sistem sisi server": "Backend Engineer",
  "Auditor senior": "Senior Auditor",
  "Bankir investasi": "Investment Banker",
  "Pengawas cabang": "Branch Supervisor",
  "Manajer urusan umum": "General Affairs Manager",
  "Spesialis pengadaan": "Procurement Specialist",
  "Konsultan pajak": "Tax Consultant",
  "Perancang produk (UI/UX)": "Product Designer (UI/UX)",
  "Kepala operasional": "Operations Lead",
  "Mitra bisnis sumber daya manusia": "HR Business Partner",
  "Analis keuangan": "Financial Analyst",
  "Perencana strategi merek": "Brand Strategist",
  "Konsultan manajemen": "Management Consultant",
  "Fasilitator tim Scrum": "Scrum Master",
  "NONE": "None reported",
  "HYPERTENSION_STAGE1": "Stage 1 hypertension",
  "GERD_RINGAN": "Mild GERD",
  "PREDIABETES_GLUKOSA": "Prediabetes",
  "CHRONIC_GASTRITIS": "Chronic gastritis",
  "BORDERLINE_CHOLESTEROL": "Borderline high cholesterol",
  "GERD_MAAG": "GERD / gastritis"
};

export function personaLabel(value: string): string {
  return PERSONA_LABELS[value] ?? value;
}

export function personaRationale(value: string): string {
  return value;
}
