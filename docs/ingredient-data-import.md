# Impor bahan dan referensi nutrisi

## Status

Branch: `feat/ingredient-data-import`, dari commit `95e1c04` yang sudah dibagikan tim.

Impor Aiven berhasil pada 7 November 2026 pukul 13:29 WIB. Receipt `ingredient-import-result.json` berstatus `committed` dengan `existing_rows_preserved: true`. Pemeriksaan ulang pukul 13:30 WIB menghasilkan nol penambahan dan nol konflik; seluruh 77 sumber dan 406 porsi tetap sama. Bukti: `ingredient-import-verification.json`.

Pemeriksaan tambahan endpoint nutrisi dan graph setelah itu terhalang slot koneksi Aiven yang kembali penuh. Hasil impor tetap sudah terverifikasi; akses aplikasi secara live belum dapat dinyatakan stabil.

| Data | SQLite | Berhasil ditambahkan ke Aiven |
| --- | ---: | ---: |
| Bahan sumber | 77 | 77 catatan sumber |
| Bahan dengan nama Indonesia dan kategori lengkap | 75 | 75 master bahan |
| Alias nama sumber | 75 | 75 alias |
| Porsi dengan data nutrisi | 406 | 406 catatan porsi |
| Sumber yang perlu ditinjau | 2 | Disimpan tanpa dipetakan ke master |

SHA-256 `ingredients.db`:

```text
4671f4ca7eb5c0830ed742eddc1486c8bdf99cfc6617d338145a82c109ac8b31
```

Sumber yang perlu ditinjau:

- `fatsecret:36408`, Leeks: nama Indonesia dan kategori kosong. Jangan otomatis digabung dengan Bawang Prei yang sudah memiliki sumber lain.
- `fatsecret:38238`, Kidney Beans: nama Indonesia dan kategori kosong.

## Perilaku impor

- Mode default hanya membaca database dan menghasilkan rencana.
- Mode apply hanya melakukan INSERT. Nama, kategori, alias, status, resep, dan nutrisi menu yang sudah ada tidak ditimpa.
- ID sumber dan fingerprint digunakan untuk mendeteksi impor ulang. Snapshot yang sama tidak menambah duplikasi. Isi berbeda dengan ID sumber yang sama membatalkan impor untuk ditinjau.
- Alias yang cocok ke lebih dari satu bahan ditahan untuk ditinjau. Tidak ada pencocokan fuzzy.
- Migrasi 004 hanya membuat dua tabel sumber dan indeksnya. Migrasi dan insert berlangsung dalam satu transaksi PostgreSQL.
- Data mentah, porsi, nilai kosong, URL sumber, fingerprint, dan hash snapshot dipertahankan. Nilai kosong bukan nol.
- Sumber bermerek atau satuan porsi campuran tidak otomatis menjadi master bahan generik.
- Tabel baru tidak dibuat otomatis saat startup. File `.env`, SQLite, dan laporan sementara `.pending` tidak masuk Git.

## Menjalankan

Jalankan dari root repo dengan dependensi backend tersedia dan `backend/.env` terkonfigurasi.

```powershell
python scripts/import_ingredient_snapshot.py --source ingredients.db
```

Periksa `docs/ingredient-import-plan.json`, terutama `conflicts`, `needs_review`, dan `insert_counts`. Gunakan hash dari rencana yang baru diperiksa:

```powershell
python scripts/import_ingredient_snapshot.py --source ingredients.db --apply --create-source-tables --expected-sha256 4671f4ca7eb5c0830ed742eddc1486c8bdf99cfc6617d338145a82c109ac8b31 --report docs/ingredient-import-result.json
python scripts/import_ingredient_snapshot.py --source ingredients.db --report docs/ingredient-import-verification.json
```

Impor berhasil jika receipt berstatus `committed`, `existing_rows_preserved` bernilai `true`, dan pemeriksaan berikutnya menghasilkan nol penambahan serta nol konflik. File `.pending` saja bukan bukti commit; setelah koneksi terputus, jalankan dry run untuk memeriksa keadaan aktual.

Tidak ada rollback otomatis yang menghapus data. Jika ada pemetaan keliru, tinjau ID pada receipt sebelum melakukan koreksi terpisah. Jangan jalankan ulang dengan menghapus tabel atau mengosongkan katalog.

## Pemakaian di aplikasi

- Admin: buka pengelolaan bahan, cari `Tempe` atau alias `Tempeh`, lalu pilih `Nutrisi`.
- Merchant: pilih bahan di editor komposisi, lalu pilih `Nutrisi` pada bahan tersebut.
- Pilih porsi untuk melihat nilai yang tepat pada sumber. Angka tidak otomatis mengikuti takaran resep.
- Tautan FatSecret tersedia agar bentuk bahan dan porsinya dapat diperiksa. Nilai vitamin/mineral tanpa unit terverifikasi tetap disimpan mentah dan tidak ditampilkan sebagai nilai bersatuan.
- API: `GET /api/ingredients/{ingredient_id}/nutrition`.

## Knowledge Graph

Graph sumber membaca database terbaru pada setiap permintaan. Alur relasi:

```text
Menu dengan resep tersimpan
  RECIPE_CONTAINS -> Master bahan
  HAS_SOURCE_RECORD -> Catatan FatSecret
  HAS_SERVING -> Porsi dan nutrisi sumber
```

Endpoint:

- `GET /api/graph/catalog/stats`
- `GET /api/graph/catalog/ingredients/{ingredient_id}`
- `GET /api/graph/catalog/menus/{menu_id}`

Nama menu saja tidak menghasilkan relasi resep. Menu tanpa komposisi mengembalikan `recipe_missing`. Resep yang sudah tersimpan tetap berstatus kelengkapan belum terverifikasi. Graph ini tidak menambah aturan medis, menyatakan bebas alergen, menghitung ulang makro menu, atau mengganti graph klinis lama. Data baru belum otomatis memengaruhi ranking AI.

Untuk demo hubungan menu sampai sumber, merchant perlu memasukkan komposisi dan takaran yang benar untuk menu pilihannya melalui editor. Hindari membuat resep contoh pada menu nyata tanpa mengetahui komposisinya.

## Koneksi Aiven

Importer memakai satu koneksi sementara yang ditutup setelah transaksi. Backend sebelumnya mengizinkan sampai 30 koneksi per worker; default baru dibatasi menjadi 2, tanpa overflow, dengan waktu tunggu pool 10 detik. Nilai dapat dikonfigurasi melalui `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, dan `DB_POOL_TIMEOUT_SECONDS`.

Perubahan ini berlaku setelah backend menggunakan kode baru dan dimulai ulang. Proses lama dan client database di komputer lain tetap perlu ditutup bila tidak dipakai. Menutup halaman frontend tidak menutup pool backend.

## Verifikasi

- `python scripts/run_backend_tests.py`: 104 test lulus menggunakan SQLite terisolasi; tidak mengakses Aiven atau model live.
- `npm.cmd test` di frontend: 52 test lulus, termasuk perubahan porsi, nilai kosong dibanding nol, kegagalan API, dan respons terlambat.
- `npm.cmd run typecheck`: lulus.
- ESLint pada file frontend yang berubah: lulus.
- Tes importer mencakup data lama tetap utuh, impor ulang, konflik sumber, rollback, alias ambigu, metadata tidak lengkap, dan satuan porsi.
- Tes graph memastikan relasi hanya berasal dari resep tersimpan; makro menu tidak berubah.
- Snapshot asli juga berhasil diimpor ke SQLite sementara: 75 bahan dapat dibaca melalui layanan nutrisi dan graph, 398 porsi terhubung ke bahan, dan 8 porsi dari dua sumber tetap menunggu peninjauan. Impor ulang menghasilkan nol penambahan. Bukti lokal: `ingredient-import-local-verification.json`; ini bukan hasil impor Aiven.
- Setelah pembatasan pool ditambahkan, 24 test suite ingredients dijalankan ulang dan lulus.
- Impor dan pembacaan ulang Aiven berhasil. Pengujian browser dengan akun admin/merchant masih diperlukan.

## Integrasi tim dan prioritas berikutnya

Commit perubahan pada branch ini. Integrasikan lewat PR ke branch integrasi tim setelah baseline `95e1c04` tersedia di sana. Modul auth dan checkout tidak dirombak. File bersama yang perlu diperhatikan saat merge: `main.py`, konfigurasi database, registrasi model, `.env.example`, dan `NUTRISEA_BUILD.md`. Branch baru mengurangi benturan kerja; hasil merge tetap harus diuji.

Prioritas berikutnya:

1. Impor Aiven dan pemeriksaan impor ulang selesai; gunakan receipt sebagai bukti.
2. Uji browser admin dan merchant dengan akun nyata; isi resep menu demo berdasarkan data merchant.
3. Tinjau dua identitas sumber yang belum lengkap dan kesesuaian bahan mentah/matang.
4. Jalankan acceptance test utama pada `NUTRISEA_BUILD.md`: preferensi, kandidat kosong, isolasi akun, dan checkout.
5. Rekam demo serta catat diff, hasil tes, keputusan tim, dan kontribusi Codex. Jangan mengklaim akurasi nutrisi atau peningkatan rekomendasi yang belum diukur.
