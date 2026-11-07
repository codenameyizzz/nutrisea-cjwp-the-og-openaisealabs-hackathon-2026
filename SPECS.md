# NutriSea Fix and Alignment Specs

## Status

Daftar ini berasal dari inspeksi kode, bukan hasil pengujian aplikasi langsung. Temuan harus diverifikasi saat implementasi. Dokumen ini tidak menyatakan perbaikan sudah selesai.

P0 wajib selesai sebelum submission. P1 memperkuat demo utama. P2 dikerjakan jika waktu tersedia.

## P0.1 Konsistensi filter pantangan

File: `backend/app/api/recommend.py`, `backend/app/core/guardrails.py`, dan jalur ranking terkait.

Masalah:

- `safe_candidates or catalog` mengembalikan kandidat yang sebelumnya ditolak ketika hasil filter kosong.
- Endpoint swap memilih alternatif tanpa filter yang sama.
- `passed_guardrails` memuat klaim pemeriksaan yang belum seluruhnya dilakukan.

Perubahan:

- Gunakan aturan pantangan yang konsisten untuk rekomendasi, swap, dan pilihan akhir.
- Jangan melonggarkan alergi atau batas wajib untuk memperoleh hasil.
- Jika kandidat kosong, kembalikan status tidak ada menu sesuai dan alasan yang jelas.
- Validasi ulang pilihan AI terhadap ID kandidat dan aturan wajib sebelum ditampilkan.
- Tampilkan hanya pemeriksaan yang benar-benar dilakukan. Data yang tidak tersedia tidak boleh dianggap sudah terverifikasi.

Kriteria selesai:

- Seluruh kandidat terlarang menghasilkan respons tanpa rekomendasi.
- Swap tidak dapat mengembalikan menu yang melanggar pantangan.
- Pilihan di luar kandidat ditolak.
- Ada pengujian regresi untuk ketiga kasus tersebut.

## P0.2 Status checkout sesuai hasil backend

File: `frontend/src/app/cart/page.tsx` dan endpoint order terkait.

Masalah:

- Status sukses dipasang dalam `finally`, termasuk saat request gagal.
- Respons HTTP tidak diperiksa sebelum menampilkan konfirmasi.
- Merchant, catatan dapur, dan recommendation ID ditentukan secara tetap.

Perubahan:

- Periksa status HTTP dan hasil order sebelum menampilkan sukses.
- Gunakan `finally` hanya untuk menghentikan loading.
- Pertahankan keranjang ketika request gagal dan tampilkan tindakan retry.
- Kirim merchant, item, catatan, dan referensi rekomendasi sesuai pilihan pengguna.
- Validasi item, harga, dan total di backend; jangan mempercayai total dari browser.
- Cegah order ganda akibat klik atau retry berulang.
- Nyatakan checkout sebagai simulasi sampai integrasi resmi tersedia.

Kriteria selesai:

- Kegagalan jaringan dan HTTP error tidak menampilkan sukses atau menghapus keranjang.
- Sukses menampilkan order ID yang benar-benar tersimpan.
- Isi order sesuai keranjang; retry tidak membuat duplikat.

## P0.3 Transparansi AI dan simulasi

File: `backend/app/ai/planner.py`, `backend/app/ai/vision.py`, `backend/app/api/merchant.py`, dan `frontend/src/components/SeaBankModal.tsx`.

Perubahan:

- Bedakan hasil model, fallback deterministik, dan layanan yang tidak tersedia dalam respons API dan UI.
- Jangan menyajikan hasil fallback scanner sebagai analisis foto yang berhasil.
- Labeli saldo, reward, bunga, transaksi, dan merchant insights sintetis sebagai data demo.
- Hapus atau beri label asumsi pada angka 65 pengguna, peningkatan order 20%, dan manfaat lain yang belum diukur.
- Jangan mengklaim pesanan terkirim ke ShopeeFood atau dana masuk SeaBank tanpa integrasi nyata.
- Hapus klaim bahan, minyak baru, higiene, atau kepastian klinis yang tidak didukung data terverifikasi.

Kriteria selesai:

- Pengguna dapat mengetahui apakah hasil berasal dari AI, fallback, atau simulasi.
- Gangguan API tidak menghasilkan klaim analisis atau transaksi yang tidak terjadi.
- Pitch dan UI menjelaskan batas prototipe secara konsisten.

## P0.4 Aturan dan dokumen submission

File: `README.md`, `backend/docs/AI_WORKSPACE_NOTES.md`, dan materi submission.

Perubahan:

- Catat klarifikasi tim bahwa kode dibuat pada hari kompetisi; persiapan sebelumnya berupa rancangan.
- Klarifikasi catatan Odysseus sesuai fakta. Jangan menyatakan kode lama sebagai kode baru.
- Siapkan deklarasi OSS, sumber data, dan pekerjaan khusus hackathon.
- Perbaiki referensi dokumen yang tidak tersedia dan informasi dataset yang sudah usang.
- Ubah acuan pitch dari 3 menit menjadi 6 menit, ditambah 2 menit Q&A.
- Pastikan presentasi berbahasa Inggris dan repository publik baru tersedia.
- Siapkan satu submission Google Form sebelum 16:30 WIB, mengikuti pembaruan resmi panitia jika ada.

Kriteria selesai:

- README, writeup, deklarasi, dan demo konsisten dengan produk yang berjalan.
- Tidak ada secret dalam materi atau repository publik.
- Semua komponen submission siap dan penanggung jawab pengiriman ditetapkan.

## P1.1 Buktikan adaptasi dari memori

File: `backend/app/api/chat.py`, `backend/app/services/memory_extractor.py`, `backend/app/services/knowledge_graph.py`, dan jalur rekomendasi frontend/backend.

Perubahan:

- Pastikan preferensi yang dinyatakan pengguna tersimpan pada user yang benar.
- Terapkan pembaruan pada jalur rekomendasi yang benar-benar digunakan UI.
- Jika ekstraksi berjalan di background, tampilkan status dan jangan menyatakan pembelajaran selesai sebelum tersimpan.
- Utamakan koreksi eksplisit terbaru pengguna atas preferensi lama.
- Tampilkan alasan rekomendasi berubah berdasarkan preferensi yang tersimpan.

Kriteria selesai:

- Pengguna mengatakan tidak ingin menu tertentu; rekomendasi berikutnya menyesuaikan.
- Pembaruan tetap berlaku setelah refresh dan tidak memengaruhi pengguna lain.
- Koreksi preferensi mengubah hasil berikutnya.
- Demo menunjukkan rekomendasi sebelum dan sesudah perubahan.

## P1.2 Rekalibrasi berdasarkan input nyata

File: `backend/app/api/recalibrate.py` dan `frontend/src/app/scanner/page.tsx`.

Masalah: endpoint mengembalikan menu tetap dan pesan 320 kcal meskipun input berbeda.

Perubahan:

- Hitung penyesuaian dari input, catatan konsumsi, dan target pengguna yang tersedia.
- Pilih dari katalog dengan filter pantangan dan anggaran yang sama.
- Jangan menyatakan keseimbangan mingguan tercapai jika data mingguan tidak tersedia.
- Tampilkan estimasi dan keterbatasan data secara singkat.

Kriteria selesai:

- Input berbeda menghasilkan perhitungan yang sesuai, meskipun pilihan menu dapat tetap sama.
- Pesan dan angka cocok dengan input.
- Kandidat kosong ditangani tanpa melewati pantangan.

Jika belum selesai, keluarkan klaim rekalibrasi otomatis dari demo utama.

## P1.3 Kontrak hasil AI

File: `backend/app/ai/planner.py` dan respons API terkait.

Masalah: JSON mode digunakan tanpa validasi kontrak hasil yang memadai.

Perubahan:

- Tetapkan skema respons dan validasi di server.
- Gunakan schema-constrained output jika didukung model dan endpoint yang dipakai.
- Pilih menu melalui ID katalog. Ambil harga dan atribut utama dari data server.
- Batasi alasan AI pada atribut yang tersedia.
- Tangani output tidak valid, timeout, dan kandidat di luar katalog secara eksplisit.

Kriteria selesai:

- Output tidak valid tidak merusak UI.
- AI tidak dapat menciptakan menu, harga, atau label bebas alergen yang tidak didukung katalog.

## P1.4 Keandalan konfigurasi demo

File: `frontend/src/lib/api.ts` dan komponen yang masih memakai `http://127.0.0.1:8000` langsung.

Perubahan:

- Gunakan konfigurasi API bersama untuk semua request.
- Pastikan autentikasi dan akses user konsisten pada data profil, memori, dan order.
- Sediakan data demo yang dapat dipulihkan tanpa menghapus data lain.
- Dokumentasikan setup, environment, dan urutan menjalankan aplikasi.

Kriteria selesai:

- Satu konfigurasi base URL berlaku untuk seluruh alur demo.
- Jika memakai demo online, browser juri tidak diarahkan ke backend localhost.
- Alur utama berjalan ulang dari kondisi awal yang diketahui.

## P1.5 Bukti kualitas dan penggunaan Codex

Perubahan:

- Jalankan pemeriksaan yang relevan dan catat hasil aktual.
- Prioritaskan pengujian pantangan, kandidat kosong, output AI tidak valid, perubahan memori, dan checkout gagal.
- Ukur latensi rekomendasi serta keberhasilan alur pada skenario yang dinyatakan.
- Jika memungkinkan, minta calon pengguna menyelesaikan tugas memilih makanan dan catat waktu serta kendalanya.
- Dokumentasikan kontribusi Codex melalui tugas, diff atau commit, verifikasi, dan review tim.

Kriteria selesai:

- Hasil pengujian menyebut jumlah skenario, kondisi pengujian, dan kegagalan yang tersisa.
- Klaim dampak hanya menggunakan hasil yang benar-benar diukur.
- Tim dapat menunjukkan minimal dua kontribusi Codex yang konkret beserta verifikasinya.

## P2 Pengembangan pendukung

- Ganti merchant insights sintetis dengan agregasi aktivitas nyata setelah ada data yang cukup.
- Lengkapi provenance nutrisi per item: sumber, ukuran porsi, dan status estimasi.
- Validasi aturan domain dengan ahli sebelum memperluas klaim Deep Domain AI.
- Perluas fitur merchant, reward, dan visualisasi hanya setelah alur utama stabil.

## Definition of done

- Semua P0 terpenuhi.
- Alur preferensi, rekomendasi, pembaruan memori, dan order simulasi berjalan utuh.
- Pantangan tidak dapat dibatalkan oleh fallback atau swap.
- Status AI, data demo, dan transaksi ditampilkan dengan jujur.
- Demo Inggris selesai dalam 6 menit dan siap untuk 2 menit Q&A.
- Repository publik, writeup, deklarasi, dan pengiriman form selesai sesuai deadline.
