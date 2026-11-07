# Dokumentasi Arsitektur NutriGraph (Clinical Knowledge Graph)

NutriGraph adalah engine Knowledge Graph klinis dan kuliner yang dirancang untuk NutriSea Co-Pilot. Sistem ini memvalidasi keamanan menu makanan Indonesia, mencegah halusinasi AI, dan menghasilkan rekomendasi nutrisi berbasis bukti ilmiah.

---

## 1. Ringkasan Penerapan

NutriGraph memetakan relasi heterogen antara persona pekerja urban, kondisi medis, bahan kuliner Nusantara, metode pengolahan, dan katalog menu makanan secara in-memory.

### Taksonomi Simpul (Node Types)
- PERSONA: 120 profil pekerja urban lengkap dengan biometrik (BMI, BMR, TDEE), target kalori makan siang, batas anggaran, alergen, dan riwayat klinis.
- CONDITION: Kondisi kesehatan (GERD_MAAG, BORDERLINE_CHOLESTEROL, HYPERTENSION_STAGE1, PREDIABETES_GLUKOSA, OBESITY).
- INGREDIENT: Bahan masakan Indonesia (santan kental, cabai rawit ekstrem, jeroan, minyak jelantah deep fry, dada ayam fillet, tempe fermentasi, ikan segar, bayam/labu siam).
- COOKING_METHOD: Teknik pengolahan (goreng deep fry, bakar rempah, kukus/rebus, kuah bening, gulai santan).
- NUTRIENT_LIMIT: Batas toleransi makro/mikronutrien per porsi (maksimal natrium, lemak jenuh, gula).
- ALLERGEN: Pemicu alergi spesifik (udang, kacang, telur, laktosa susu).
- DISH: 80 hidangan Indonesia terstandarisasi dari database FatSecret.
- MEMORY_ITEM: Fakta klinis atau pantangan dinamis yang diekstrak dari percakapan pengguna.

### Taksonomi Relasi (Edge Types)
- HAS_CONDITION: Persona -> Kondisi Medis
- CONTRAINDICATES: Kondisi Medis -> Bahan Kuliner (Tingkat: HIGH)
- RECOMMENDS_BENEFIT: Kondisi Medis -> Bahan Kuliner Bermanfaat
- CONTRAINDICATES_METHOD: Kondisi Medis -> Metode Pengolahan
- ENFORCES_LIMIT: Kondisi Medis -> Batas Nutrien
- HAS_ALLERGY: Persona -> Alergen
- CONTAINS_INGREDIENT: Hidangan -> Bahan Kuliner
- CONTAINS_ALLERGEN: Hidangan -> Alergen
- PREPARED_BY: Hidangan -> Metode Pengolahan
- HAS_LEARNED_AVERSION: Persona -> Bahan Kuliner (Dihasilkan dinamis dari memori percakapan)

---

## 2. Teknologi yang Digunakan

1. NetworkX (Python): Struktur data MultiDiGraph in-memory berkecepatan tinggi untuk eksekusi traversal multi-hop dan kalkulasi subgraf dalam hitungan milidetik.
2. FastAPI: REST API interface pada `/api/graph/*` untuk melayani query graf, validasi keamanan menu, ekspor visualisasi, dan pemanggilan coaching.
3. Ontologi Medis JSON:
   - clinical_rules.json: Standar baku batas nutrisi dan acuan klinis resmi (Perkeni, PERKI, PGI).
   - ingredient_ontology.json: Taksonomi bahan makanan Nusantara, mekanisme patofisiologis, dan alternatif pengganti.
4. OpenAI Python SDK: Integrasi model GPT-4o untuk penalaran Graph-RAG dengan mekanisme fallback deterministik otomatis saat API key belum disetel.
5. PostgreSQL & SQLAlchemy: Penyimpanan relasional jangka panjang untuk entitas persona dan memori percakapan Odysseus.
6. JSON Node-Link Schema: Format standar simpul dan relasi yang kompatibel langsung dengan visualizer visual seperti Cytoscape atau D3.js.

---

## 3. Alur Kerja (Workflow)

1. Resolusi Persona: Sistem memuat simpul persona pengguna untuk mengambil target kalori makan siang, pagu anggaran, serta daftar kondisi klinis dan alergen aktif.
2. Multi-Hop Guardrail Traversal: Mesin menelusuri graf dari simpul persona menuju menu makanan melalui relasi:
   Persona -> Kondisi Medis -> Kontraindikasi Bahan/Metode <- Hidangan
   Jika ditemukan simpul yang bertabrakan, hidangan langsung diberi label CONTRAINDICATED atau CRITICAL dan dikeluarkan dari kandidat aman.
3. Multi-Factor Graph Scoring: Menu yang lolos dinilai menggunakan pembobotan terukur:
   - Skor Dasar: 70 poin.
   - Bonus Keselarasan Dataset: +15 poin jika menu telah terpetakan klinis pada riset persona.
   - Penalti Deviasi Kalori: Pengurangan poin jika kalori menyimpang dari target makan siang.
   - Bonus Manfaat Fisiologis: +5 poin per bahan aktif yang direkomendasikan untuk kondisi pengguna.
   - Kepatuhan Anggaran: Penyesuaian poin terhadap batas pengeluaran pengguna.
4. Pembentukan Rantai Bukti (Proof-Chain Narrative): Graf merangkum jalur verifikasi, kalkulasi delta kalori, dan sitasi pedoman medis sebagai bukti pertanggungjawaban ilmiah.
5. Injeksi Memori Dinamis: Saat pengguna menyampaikan keluhan baru di sesi chat, sistem membuat simpul memori baru dan menghubungkan relasi pantangan ke bahan terkait secara otomatis.

---

## 4. Penerapan AI pada Knowledge Graph (Graph-RAG)

Sistem menerapkan arsitektur hibrida Graph-Augmented Generation:

1. Graf sebagai Penjaga Kebenaran (Ground Truth): Knowledge Graph bertindak sebagai pengaman mutlak (guardrail). AI tidak diizinkan memilih menu secara spekulatif dari daftar mentah. Seluruh kandidat menu yang sampai ke tahap sintesis telah divalidasi keamanannya oleh algoritma graf deterministik.
2. AI sebagai Mesin Komunikasi dan Sintesis Kontekstual: Model OpenAI GPT-4o menerima subgraf bukti klinis dan menyusun pesan coaching personal yang empatik, tajam, dan mudah dipahami dalam Bahasa Indonesia tanpa mengubah substansi medis.
3. Arsitektur Dual-Mode:
   - Mode Deterministik (Offline / Tanpa API Key): Menghasilkan penjelasan klinis berbasis template aturan graf dengan sitasi medis lengkap.
   - Mode OpenAI GPT-4o (Online): Menghasilkan narasi percakapan adaptif dengan tetap merujuk pada bukti subgraf yang valid.

---

## 5. Contoh Konkret Penerapan

### Kasus 1: Validasi Keamanan Menu pada Penderita GERD
- Subjek: Rangga Siregar (DIGE_RANGGA_KUNINGAN_070), kondisi GERD_MAAG.
- Jalur Graf:
  PERSONA:DIGE_RANGGA -> COND:GERD_MAAG -> CONTRAINDICATES -> ING:cabai_rawit_ekstrem & ING:santan_kental
- Evaluasi Menu:
  - Menu A (Ayam Geprek Sambal Korek): Graf mendeteksi relasi CONTAINS_INGREDIENT ke cabai_rawit_ekstrem. Hasil: Ditolak (CONTRAINDICATED). Mekanisme klinis: Kapsaisin merangsang reseptor TRPV1 lambung dan memicu hipersekresi asam klorida.
  - Menu B (Nasi Tim Ayam Jamur Kuah Bening): Graf mendeteksi teknik pengolahan kukus/rebus dan kuah bening kaldu. Hasil: Lolos (SAFE, Skor: 82.1).

### Kasus 2: Kontrol Batas Natrium pada Hipertensi
- Subjek: Agnes Wulandari (PREV_AGNES_MENTENG_003), kondisi HYPERTENSION_STAGE1.
- Jalur Graf:
  PERSONA:AGNES -> COND:HYPERTENSION_STAGE1 -> ENFORCES_LIMIT -> max_sodium_mg: 750 mg
- Evaluasi Menu:
  Menu soto dengan kadar natrium 890 mg otomatis diblokir karena melampaui batas toleransi 750 mg per porsi makan siang.

### Kasus 3: Pembelajaran Dinamis Memori Odysseus
1. Pengguna berinteraksi di chat: "Perut saya sering mual dan begah setelah makan olahan santan pekat."
2. API POST `/api/graph/memory/add` menerima teks tersebut dan memetakan kata "santan" ke simpul `ING:santan_kental`.
3. Graf membuat simpul `MEMORY_ITEM` dan menambahkan edge `HAS_LEARNED_AVERSION` dari persona ke santan kental.
4. Pada pencarian menu berikutnya, seluruh masakan bersantan langsung dibatasi bagi pengguna tersebut.
