# NutriSea Consumer Feature & UI Specifications

Dokumen ini menerjemahkan hasil riset konsumen (`consumer_research.md`) menjadi spesifikasi antarmuka (UI), komponen interaktif, data state, dan alur aplikasi nyata untuk implementasi Web-App (Next.js / React + Vite) pada hackathon 7 November 2026.

---

## 1. Matriks Pemetaan: Masalah Riset ke Fitur Nyata Aplikasi

| Temuan Riset Konsumen                  | Masalah Psikologis / Lapangan                                         | Implementasi Nyata di Aplikasi (UI & Logic)                                                                                                                                                                        | Komponen / Layar                   |
| :------------------------------------- | :-------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------- |
| **Cognitive Overload**           | Pusing scrolling 20 menit memilih menu di jam 12:00.                  | **Proactive Single-Recommendation Card**: Menggantikan katalog ribuan menu dengan 1 rekomendasi terbaik yang sudah dihitung sesuai sisa kalori, promo sekitar, dan preferensi rasa.                          | Header / Hero Section              |
| **1-Click Execution**            | Malas mengetik catatan masak khusus (tanpa santan, setengah nasi).    | **Pre-Filled ShopeeFood Cart Injection**: Tombol 1-klik yang langsung memicu checkout dengan catatan masak standar kuliner sehat otomatis.                                                                   | Action Button Cart Injector        |
| **MyFitnessPal Fatigue**         | 85% churn karena malas ketik gram & cari menu lokal yang ribet.       | **2-Second Qualitative Photo Scanner**: Foto piring pakai GPT-4o Vision, deteksi kategori kualitatif (misal: "Gorengan Tepung Tinggi Minyak") + slider konfirmasi 1-tap tanpa hitungan gram palsu.           | Modal / Drawer Scan Kamera         |
| **All-or-Nothing Fallacy**       | Merasa "diet gagal total" setelah makan 1 gorengan dadakan jam 16:00. | **Dynamic Dinner Recalibration Toast**: Begitu snack terdeteksi, aplikasi tidak menampilkan warna merah/hukuman, melainkan langsung menyesuaikan rekomendasi makan malam ke menu serat tinggi rendah kalori. | Live Notification & Dinner Card    |
| **Clean Eating Mahal**           | Mitos bahwa makan sehat harus salad impor Rp 80.000.                  | **Local Warung Price Anchor**: Kurasi menu Warteg, Nasi Ayam Bakar, Soto Bening lokal di kisaran harga Rp 25.000 - Rp 35.000 per porsi.                                                                      | Filter & Badge Harga di Kartu Menu |
| **Oddyseus Behavioral Learning** | Malas mengisi form survei berulang kali.                              | **Implicit Swap Learner**: Jika user menolak rekomendasi ikan dan memilih ayam 3 kali, Long-Term Memory (LTM) otomatis memperbarui preferensi tanpa perlu survei ulang.                                      | Drawer Profil & State Handler      |
| **Sea Ecosystem Synergy**        | Kurang motivasi konsisten jangka panjang.                             | **SeaBank Wellness Saver Widget**: Tracker streak harian dengan saldo micro-cashback nyata yang hanya bertambah jika order makanan sehat selesai di ShopeeFood.                                              | Widget Finansial di Bawah Halaman  |

---

## 2. Rincian 5 Layar & Komponen UI Utama (Spesifikasi Frontend)

### Layar 1: Hero Section - "Smart Proactive Lunch Card" (Menjawab Cognitive Overload)

* **Tujuan**: Menghilangkan waktu scrolling 20 menit pada jam makan siang.
* **Elemen Tampilan**:
  * **Badge Waktu & Konteks**: `Rekomendasi Siang (11:30 WIB) - Sisa Budget: 520 kcal`.
  * **Nama Restoran & Jarak**: `Warteg Berkah Mandiri - Kuningan (0.8 km)`.
  * **Nama Menu Sehat**: `Paket Sehat: Dada Ayam Bakar + Sayur Bening Bayam + Nasi Merah`.
  * **Tagging Alasan (Why this fits you)**:
    * `Hemat 20% (Promo Hari Ini)`
    * `Tinggi Protein (36g)`
    * `Bebas Santan & Bebas Kacang`
  * **Harga Komparasi**: `Rp 25.600` (coret `Rp 32.000`).
  * **Tombol Aksi Utama**: `[Pesan Sekarang ke ShopeeFood (1-Klik)]`
    * Saat diklik, menampilkan pop-up singkat: *"Pesanan disiapkan dengan catatan: Nasi setengah porsi, kuah bening tanpa santan, sambal dipisah."*
  * **Tombol Alternatif**: `[Ganti Menu Lain / Swap]`

---

### Layar 2: Qualitative Photo Scanner Drawer (Menjawab MyFitnessPal Fatigue)

* **Tujuan**: Logging makanan darurat/snack dalam 2 detik tanpa pusing menimbang gram.
* **Elemen Tampilan**:
  * Tombol mengambang di pojok kanan bawah: `[+ Catat Cepat via Foto]`.
  * **Preview Hasil Analisis AI (Mock GPT-4o Vision)**:
    * Foto yang diunggah: 1 piring berisi 2 bakwan goreng dan es teh manis.
    * **Label Deteksi Kualitatif**:
      * Kategori: `Gorengan Tepung & Minyak Nabati`
      * Indeks Glikemik: `Tinggi (Kandungan Gula Sederhana)`
      * Estimasi Beban: `+320 kcal / Lemak Jenuh Sedang`
    * **Slider Konfirmasi 1-Tap**:
      * Pilihan porsi cepat: `[Cicip Sedikit]`, `[1 Porsi Sedang]`, `[Porsi Besar]`.
    * **Tombol Konfirmasi**: `[Simpan ke Jurnal Harian]`.

---

### Layar 3: Dynamic Recalibration Banner (Menjawab Diet Guilt / All-or-Nothing Fallacy)

* **Tujuan**: Menghilangkan rasa bersalah saat pengguna memakan cemilan berkalori tinggi.
* **Elemen Tampilan**:
  * Begitu tombol simpan ditekan pada Layar 2, muncul banner hijau di layar utama:
    * **Judul**: `Keseimbangan Mingguan Terjaga!`
    * **Pesan**: *"Snack gorengan tercatat (+320 kcal). Tenang, menu makan malam otomatis disesuaikan ke Pecel Madiun Tinggi Serat & Sup Ayam Bening agar target kalori harian Anda tetap seimbang tanpa rasa lapar."*
  * **Kartu Makan Malam Otomatis Berubah**:
    * Menu makan malam yang tadinya dijadwalkan nasi ayam bakar langsung berganti menjadi: `Pecel Sayur Segar + Tahu Tempe Kukus (280 kcal) - Warung Bu Sri (Rp 22.000)`.

---

### Layar 4: Ringkasan Keseimbangan Harian (Daily Balance Ring)

* **Tujuan**: Pengguna tidak melihat angka kalori mati yang kaku, melainkan melihat persentase gizi seimbang sesuai pedoman Kementerian Kesehatan (*Isi Piringku*).
* **Elemen Tampilan**:
  * Visual 3 Bar / Progress Ring:
    1. **Kalori**: `1.150 / 1.600 kcal terpakai` (Indikator warna hijau stabil).
    2. **Komposisi Isi Piringku**: `50% Sayur & Buah, 25% Karbohidrat, 25% Protein`.
    3. **Batas Aman Sodium**: `1.200 / 2.000 mg (Aman)`.
  * Status Teks: `Metabolisme Seimbang (Dalam Batas Toleransi)`.

---

### Layar 5: SeaBank Wellness Saver Widget (Menjawab Retensi & Ekosistem Sea)

* **Tujuan**: Menghubungkan kebiasaan makan sehat dengan keuntungan finansial riil di ekosistem Sea.
* **Elemen Tampilan**:
  * Kartu di bagian bawah aplikasi dengan branding SeaBank:
    * **Saldo Tabungan Sehat**: `Rp 45.000`.
    * **Streak Mingguan**: `Hari ke-5 Berturut-turut!`.
    * **Pending Reward**: `+Rp 5.000 Cashback akan masuk ke rekening SeaBank setelah pesanan makan malam selesai diantar.`
    * **Catatan Transparansi**: `Reward terverifikasi otomatis via riwayat transaksi ShopeeFood.`

---

## 3. Struktur State Data di Frontend (Next.js / React)

Untuk memfasilitasi demo dinamis saat hackathon, state frontend dibagi menjadi 2 layer:

```typescript
// State Layer untuk Komponen Frontend (Contoh: Zustand / React Context)

interface ConsumerAppState {
  // Long-Term Memory (Persisten)
  profile: {
    userId: string;
    name: string;
    bmiCategory: "NORMAL" | "OVERWEIGHT" | "PRE_DIABETIC";
    dailyCalorieTarget: number; // e.g. 1650
    allergies: string[]; // ["PEANUTS", "SEAFOOD"]
    maxBudgetPerMeal: number; // e.g. 35000
    learnedPreferences: {
      preferredProteins: string[]; // ["AYAM", "TEMPE", "TELUR"]
      dislikedIngredients: string[]; // ["PARE", "PETAI"]
    };
  };

  // Short-Term Memory (Dinamis Harian)
  todaySession: {
    consumedCalories: number; // e.g. 1150
    consumedSodiumMg: number; // e.g. 1200
    loggedMeals: Array<{
      mealId: string;
      name: string;
      time: string;
      source: "SHOPEEFOOD_ORDER" | "PHOTO_LOG";
      estimatedKcal: number;
    }>;
    recalibrationActive: boolean; // True jika ada surplus cemilan yang perlu diimbangi di makan malam
  };

  // Widget Ekosistem SeaBank
  seaBankSaver: {
    currentSavingsIdr: number;
    streakDays: number;
    pendingCashbackIdr: number;
  };
}
```

---

## 4. Alur Interaksi Demo 3 Menit (Script untuk Live Pitch Juri)

Saat Yizreel atau tim mendemokan aplikasi di depan juri, jalankan 3 langkah konkret ini:

1. **Detik 00 - 45: Perlihatkan Hero Section (Cognitive Overload Solved)**
   * Tunjukkan layar ponsel/web: *"Ini jam 11:30. Daripada scrolling 20 menit, NutriSea langsung menampilkan 1 menu makan siang lokal di Kuningan seharga Rp 25.600 yang pas dengan target kalori pengguna. Kami klik pesan, pesanan otomatis masuk keranjang ShopeeFood lengkap dengan catatan masak bebas santan."*
2. **Detik 46 - 90: Simulasikan Foto Snack Sore & Rekalibrasi (Guilt-Free Dynamic Loop)**
   * Klik tombol kamera, unggah foto gorengan/snack kantor: *"Jam 4 sore ada gorengan di kantor. Tidak perlu timbang gram. Vision AI mendeteksi snack gorengan tepung. Begitu disimpan, perhatikan: aplikasi tidak menghukum pengguna dengan warna merah, melainkan langsung merekalibrasi menu makan malam menjadi sup bening rendah kalori."*
3. **Detik 91 - 150: Perlihatkan SeaBank Saver & Dashboard Warung (2-Sided Business Value)**
   * Tunjukkan widget SeaBank: *"Konsistensi ini dihadiahi cashback tabungan SeaBank yang terkunci pada transaksi nyata."*
   * Tunjukkan tab merchant: *"Warung lokal mendapatkan tagging sehat otomatis dan rekomendasi menu dari kebutuhan diet warga sekitar."*
