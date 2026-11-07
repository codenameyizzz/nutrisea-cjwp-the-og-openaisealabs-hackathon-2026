# Git Workflow and Collaboration Guide
Team: CJWP (The OG) | Project: NutriSea

Panduan ini mengatur standar pembuatan branch, komit kode, dan alur Pull Request (PR) untuk mencegah terjadinya merge conflict selama masa pengembangan dan hackathon.

---

## 1. Aturan Utama Repositori

1. Branch `main` hanya berisi kode produksi yang stabil dan siap didemokan ke juri. Dilarang push langsung ke `main`.
2. Branch `dev` adalah branch integrasi harian. Seluruh pekerjaan fitur ditargetkan ke branch ini.
3. Seluruh anggota tim wajib bekerja di branch fitur masing-masing (`feat/*`, `fix/*`, `chore/*`) yang dicabangkan dari `dev`.

---

## 2. Standar Penamaan Branch

Format: `<tipe>/<nama-singkat-fitur>`

* `feat/` : Penambahan fitur baru (contoh: `feat/photo-scanner`, `feat/hero-lunch-card`)
* `fix/` : Perbaikan bug (contoh: `fix/calorie-calculation`, `fix/cart-injection-notes`)
* `chore/` : Setup dependensi atau dataset (contoh: `chore/seed-catalog-data`)

Gunakan huruf kecil dan tanda strip (-) sebagai pemisah kata.

---

## 3. Alur Kerja dan Perintah Git (Step-by-Step)

### Langkah 1: Memulai Tugas Baru
Selalu pastikan Anda mencabangkan branch dari `dev` yang paling baru:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/nama-fitur
```

### Langkah 2: Menyimpan Perubahan (Commit)
Lakukan commit secara teratur untuk perubahan yang jelas:

```bash
git add .
git commit -m "feat: tambahkan komponen hero lunch card"
```

### Langkah 3: Menghindari Konflik Sebelum Buka PR (Wajib)
Sebelum mempublikasikan branch ke GitHub, tarik pembaruan terbaru dari `dev` menggunakan rebase. Ini memindahkan commit Anda ke posisi paling atas dan menyelesaikan potensi konflik di lokal:

```bash
git fetch origin
git rebase origin/dev
```

Jika terjadi konflik saat rebase:
1. Buka file yang berkonflik, perbaiki bagian kode yang bertabrakan.
2. Jalankan:
   ```bash
   git add <nama-file-yang-diperbaiki>
   git rebase --continue
   ```
3. Ulangi sampai rebase selesai tanpa error.

### Langkah 4: Publikasikan Branch ke GitHub

```bash
git push -u origin feat/nama-fitur
```

Catatan: Jika Anda sebelumnya sudah pernah push branch tersebut lalu melakukan rebase, gunakan perintah:
```bash
git push --force-with-lease origin feat/nama-fitur
```

### Langkah 5: Membuat Pull Request (PR) di GitHub
1. Masuk ke halaman repositori di GitHub.
2. Klik tombol "Compare & pull request".
3. Pastikan konfigurasi branch:
   * **Base branch**: `dev` (Jangan pilih `main`).
   * **Compare branch**: `feat/nama-fitur`.
4. Berikan judul ringkas dan penjelasan singkat apa yang ditambahkan.
5. Pilih Ketua Tim sebagai Reviewer.

### Langkah 6: Penggabungan Kode (Khusus Reviewer / Ketua Tim)
1. Periksa apakah kode berjalan lancar dan tidak ada error.
2. Pilih opsi **Squash and merge** di GitHub.
3. Klik "Delete branch" di GitHub setelah berhasil digabungkan.

### Langkah 7: Membersihkan Branch Lokal
Setelah PR digabungkan, kembali ke `dev` lokal dan hapus branch fitur yang sudah selesai:

```bash
git checkout dev
git pull origin dev
git branch -d feat/nama-fitur
```

---

## 4. Ringkasan Pantangan

1. Jangan pernah menjalankan `git push origin dev` atau `git push origin main` secara langsung.
2. Jangan menggabungkan kode orang lain ke branch Anda menggunakan `git merge dev`; gunakan `git rebase origin/dev`.
3. Jangan mengedit file konfigurasi environment (`.env`) ke dalam repositori git.
