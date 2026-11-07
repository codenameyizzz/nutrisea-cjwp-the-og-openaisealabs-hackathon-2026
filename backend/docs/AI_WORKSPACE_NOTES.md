# Catatan Komponen AI Workspace Backend
Team: CJWP (The OG) | Project: NutriSea

Dokumen ini mencatat pemetaan asal komponen: bagian yang diadaptasi dari framework Odysseus (CJWP-DEL-AI-Hackathon), bagian yang masih menggunakan data dummy/mock, dan bagian baru yang dikembangkan khusus untuk NutriSea.

---

## 1. Komponen yang Diambil dan Diadaptasi dari Proyek Sebelumnya (Odysseus)

1. **Hybrid Embeddings Engine** (`backend/app/ai/embeddings.py`):
   * Diambil dari arsitektur Odysseus `embeddings.py`.
   * Mempertahankan mekanisme *process-level latch* (`_http_embed_down`) yang secara otomatis beralih ke fallback lokal tanpa membuat aplikasi crash jika endpoint API bermasalah.
2. **Skema Database Dual-Tier Memory** (`backend/app/models/memory.py`):
   * Tabel `UserPreference` (Long-Term Memory) mengadopsi struktur persis dari Odysseus, lengkap dengan atribut `category`, `fact`, `pinned`, dan `uses`.
3. **Pola Ekstraksi Perilaku** (`backend/app/personas/engine.py`):
   * Mengadaptasi logika *memory extractor* Odysseus untuk mencatat keputusan pengguna secara implisit (misal: pencatatan menu swap) tanpa survei berulang.

---

## 2. Komponen yang Masih Menggunakan Data Mock / Dummy

1. **Dataset Katalog Makanan** (`backend/app/data/seed_catalog.json`):
   * Status: Berisi 5 sampel menu warung lokal Jakarta (Warteg Berkah Mandiri, Soto Kudus, Pecel Bu Sri, RM Saiyo).
   * Rencana: Perlu diperluas menjadi 30-40 variasi menu lokal lengkap dengan data Tabel Komposisi Pangan Indonesia (TKPI).
2. **Fallback Mock pada Model AI** (`backend/app/ai/vision.py` & `backend/app/ai/planner.py`):
   * Status: Menyediakan respons mock realistis jika `OPENAI_API_KEY` belum diisi di `.env`, sehingga pengujian integrasi frontend Next.js tetap berjalan lancar tanpa memotong kuota API.
3. **Analisis Permintaan Merchant** (`backend/app/api/merchant.py`):
   * Status: Endpoint `/api/merchant/demand-insights` masih menyajikan data simulasi statis (65 pencarian diet sekitar Kuningan) untuk keperluan demo skenario juri.
4. **Respon Rekalibrasi Makan Malam** (`backend/app/api/recalibrate.py`):
   * Status: Menyajikan menu penyeimbang statis (Pecel Madiun 280 kcal) saat cemilan sore dilaporkan.

---

## 3. Komponen Baru yang Dibangun Khusus untuk NutriSea

1. **Clinical Nutrition Guardrails** (`backend/app/core/guardrails.py`):
   * Penegak batas klinis berbasis standar Kementerian Kesehatan (Isi Piringku, batas sodium harian 2000mg, sodium per makan 750mg, dan pembatasan santan pekat).
2. **Tiga Preset Persona Tervalidasi** (`backend/app/personas/presets.py`):
   * Dian (Corporate Desk Worker SCBD), Budi (Preventive Health Kuningan), dan Rian (Fitness Budget Palmerah).
3. **Master AI Prompts** (`backend/app/ai/prompts.py`):
   * Cetak biru prompt untuk GPT-4o Vision kualitatif, Structured Outputs meal planner, dan merchant co-pilot.
4. **Gateway Entrypoint & CORS** (`backend/app/main.py`):
   * Setup integrasi komunikasi lintas-port langsung ke frontend Next.js (port 3000).