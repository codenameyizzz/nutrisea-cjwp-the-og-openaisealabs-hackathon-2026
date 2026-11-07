# NutriSea Build

## Tujuan

Membantu pengguna memilih makanan lokal sesuai anggaran, pantangan, dan preferensi yang berubah, lalu menyiapkan pesanan dengan konfirmasi pengguna.

Dokumen ini menjadi acuan scope hackathon. Detail perbaikan ada di [SPECS.md](./SPECS.md).

## Dasar panduan

Acuan: `[Participants Briefing Materials] ID Sea x OpenAI Hackathon.pdf`, halaman 5 sampai 9.

- Kode dibangun pada hari kompetisi, 7 November 2026. Tim mengklarifikasi bahwa persiapan sebelumnya hanya berupa rancangan atau plan.
- Jangan menyertakan kode proyek lama. Catatan adaptasi Odysseus perlu diperjelas agar membedakan inspirasi arsitektur dari penggunaan kode lama.
- Nyatakan OSS yang digunakan dan bagian yang dibangun khusus selama hackathon.
- Gunakan repository GitHub publik baru untuk hackathon.
- Kirim satu submission per tim melalui Google Form sebelum 16:30 WIB. Keterlambatan menyebabkan diskualifikasi.
- Submission berisi repository, project writeup, dan deklarasi. Demo link bersifat opsional.
- Presentasi kedua ronde wajib dalam bahasa Inggris: 6 menit demo/pitch dan 2 menit Q&A.
- Minimal satu build direction harus tercermin dalam produk yang dapat didemokan.
- Bobot numerik kriteria tidak dicantumkan dalam briefing.

Periksa pengumuman dan FAQ panitia untuk perubahan aturan.

## Arah produk

Build direction utama: Autonomous & Adaptive AI.

Build direction pendukung: AI-Native Products & Operations.

NutriGraph digunakan untuk grounding rekomendasi. Hindari klaim validasi klinis atau kemampuan setara ahli gizi tanpa bukti.

Positioning untuk pitch:

> NutriSea turns a user's budget, food restrictions, and evolving preferences into an actionable local meal choice, and adapts when those needs change.

## Scope utama

1. Pengguna memberikan anggaran, pantangan, dan preferensi.
2. Sistem menyaring katalog sebelum memilih menu.
3. AI menjelaskan pilihan berdasarkan data kandidat yang tersedia.
4. Pengguna menyampaikan perubahan preferensi melalui chat.
5. Sistem menyimpan perubahan dan menerapkannya pada rekomendasi berikutnya.
6. Pengguna mengonfirmasi pesanan simulasi.
7. Sistem menampilkan status sesuai hasil backend.

SeaBank, merchant insights, scanner, dan visualisasi graf menjadi fitur pendukung. Tampilkan hanya jika sudah stabil dan membantu cerita utama.

## Kesesuaian dengan penjurian

| Kriteria | Bukti yang disiapkan |
| --- | --- |
| Problem & Solution Fit | Satu pengguna sasaran, masalah pemilihan makanan, dan alasan alur NutriSea mengurangi pekerjaan pengguna. |
| Build Quality | Alur utama berjalan, pantangan konsisten, kegagalan ditangani, dan status transaksi akurat. |
| Insight & Originality | Perubahan preferensi benar-benar mengubah pilihan makanan dan persiapan pesanan. |
| Real-World Value | Hasil uji tugas: waktu memilih, kepatuhan anggaran, dan keberhasilan menyelesaikan alur. |
| Alignment with Build Direction | Demo input baru, pembaruan memori, dan rekomendasi yang menyesuaikan. |
| Use of Codex | Contoh tugas Codex, perubahan kode, verifikasi, dan keputusan tim yang dapat ditunjukkan. |

Jangan mengklaim peningkatan, jumlah pengguna, atau dampak kesehatan yang belum diukur.

## Rencana demo 6 menit

| Waktu | Isi |
| --- | --- |
| 00:00–00:40 | Masalah pengguna dan hasil yang ingin dicapai. |
| 00:40–01:40 | Masukkan anggaran dan pantangan; tampilkan rekomendasi beserta alasannya. |
| 01:40–03:00 | Tambahkan preferensi baru; tunjukkan memori tersimpan dan rekomendasi berubah. |
| 03:00–04:00 | Konfirmasi pesanan simulasi; tampilkan hasil penyimpanan backend. |
| 04:00–04:40 | Tunjukkan respons ketika seluruh kandidat ditolak atau layanan gagal. |
| 04:40–05:20 | Jelaskan peran OpenAI dan kontribusi Codex dengan bukti. |
| 05:20–06:00 | Sampaikan hasil pengujian, batas prototipe, dan langkah berikutnya. |

Siapkan jawaban Q&A tentang sumber nutrisi, pembaruan memori, kegagalan AI, integrasi simulasi, dan kontribusi Codex.

## Penggunaan Codex dan fasilitas

- Gunakan Codex untuk implementasi alur lengkap, review, perbaikan bug, dan pengujian kasus penting.
- Beri setiap tugas acceptance criteria dan batas file yang jelas.
- Catat tugas, perubahan, hasil verifikasi, serta keputusan manusia. Jangan membuat riwayat penggunaan yang tidak terjadi.
- Gunakan ChatGPT Pro dan API credits USD 100 dari panitia setelah memastikan aktivasi dan akses akun.
- Prioritaskan credits untuk pengujian alur nyata, variasi input, latensi, dan penanganan kegagalan.
- Jangan menambahkan model, agent, atau fitur hanya untuk menambah kompleksitas.

## Kesiapan submission

- Semua perbaikan P0 di SPECS.md selesai.
- Alur utama dapat dijalankan ulang dengan data demo yang jelas.
- README berisi setup, perintah menjalankan aplikasi, dan kebutuhan environment tanpa secret.
- Writeup menjelaskan masalah, solusi, build direction, penggunaan Codex, dan batas prototipe.
- Deklarasi menyebut OSS, sumber data, serta pekerjaan yang dibuat pada hari kompetisi.
- Semua integrasi dan angka simulasi diberi label.
- Pitch bahasa Inggris selesai dilatih dalam 6 menit.
- Form dikirim sebelum deadline; simpan bukti pengiriman.

## Rencana eksekusi 3 sampai 4 jam

Rencana dimulai pukul 11:26 WIB berdasarkan waktu yang disampaikan tim. Target build minimum selesai 14:30 WIB. Jika tersedia satu jam tambahan, gunakan sampai 15:30 WIB untuk penguatan dan rehearsal. Deadline resmi tetap 16:30 WIB; target pengiriman internal paling lambat 16:00 WIB.

Technical meeting menurut tim mengikuti briefing. Tidak ada arahan tambahan yang diketahui untuk mewajibkan Codex berjalan di dalam aplikasi.

### Keputusan scope

- Fokus satu pengguna sasaran: pekerja yang ingin memilih makan siang lokal sesuai anggaran dan preferensi tanpa mengulang pencarian.
- Pembeda utama: preferensi baru tersimpan dan mengubah rekomendasi dari katalog yang tersedia.
- OpenAI digunakan untuk memahami permintaan dan menjelaskan pilihan. Backend menentukan batas wajib, data menu, harga, dan validitas order.
- Codex digunakan secara mendalam untuk membangun, memperbaiki, menguji, dan mereview produk. Tunjukkan bukti kontribusinya.
- Jangan menambah Codex runtime, agent baru, migrasi framework, atau integrasi pembayaran dalam jendela waktu ini. Briefing menilai penggunaan Codex untuk membangun produk; integrasi runtime tidak dinyatakan wajib.
- Jangan menjadikan scanner, rekalibrasi, SeaBank, atau merchant dashboard sebagai dependensi demo utama.
- Jika fitur pendukung masih menampilkan klaim yang tidak benar, beri label simulasi atau sembunyikan dari alur demo.

### Pembagian tanggung jawab

Penugasan mengikuti peran pada README. Bila tim menukar tugas, perbarui pemiliknya sebelum mulai. Satu orang bertanggung jawab atas setiap hasil akhir.

| Pemilik | Fokus | Hasil wajib |
| --- | --- | --- |
| Yizreel | AI, memori, evaluasi, narasi Codex | Preferensi eksplisit tersimpan, diterapkan pada rekomendasi, dan dapat dibuktikan. |
| Firman Bintang | Backend, filter, order, konfigurasi runtime | Kandidat terlarang tidak lolos; API memberikan status yang benar; order tersimpan dan tervalidasi. |
| Prans Daniel | Frontend dan pengalaman demo | UI menggunakan hasil backend, memperbarui rekomendasi setelah feedback, dan menangani kegagalan. |
| William Napitupulu | Integrasi, pengujian penerimaan, pitch, submission | Versi terintegrasi lulus skenario utama; writeup, deklarasi, dan presentasi siap. |

Yizreel dan Firman menyepakati batas perubahan sebelum mengedit modul rekomendasi yang sama. William mengoordinasikan integrasi; jangan menunggu semua pekerjaan selesai untuk mencoba alur bersama.

Ikuti CONTRIBUTING.md: gunakan branch fitur, PR ke dev, dan review sebelum penggabungan. Main berisi versi stabil untuk demo.

### Jadwal dan gerbang keputusan

| Waktu WIB | Pekerjaan | Hasil dan keputusan |
| --- | --- | --- |
| 11:26-11:40 | Semua anggota menjalankan baseline; tentukan akun demo, katalog, endpoint, dan pembagian file. | Satu alur saat ini direkam; bug penghambat dicatat; kontrak minimum disepakati. |
| 11:40-12:25 | Backend memperbaiki filter dan order; AI memperbaiki jalur memori; frontend memperbaiki status dan API URL; integrator menyiapkan evaluasi dan dokumen. | Perubahan pertama siap diuji bersama. |
| 12:25-12:40 | Integrasi pertama: profil, rekomendasi, feedback, rekomendasi ulang. | Tentukan apakah adaptasi sudah nyata. Jika gagal, seluruh pekerjaan tambahan dihentikan untuk memperbaikinya. |
| 12:40-13:25 | Lengkapi penyimpanan memori, validasi hasil AI, dan checkout; tambahkan pengujian regresi yang relevan. | Alur utama dan kasus kegagalan berjalan. |
| 13:25-13:45 | Integrasi kedua dan evaluasi terukur. | Catat hasil aktual, latency, kegagalan, dan batas prototipe. |
| 13:45-14:15 | Hentikan penambahan fitur; perbaiki hanya penghambat demo; rapikan klaim dan dokumentasi. | Kandidat versi demo tersedia. |
| 14:15-14:30 | Jalankan demo lengkap, verifikasi repository dan bahan submission. | Build minimum selesai; demo 6 menit dapat dijalankan. |
| 14:30-15:00 | Jika waktu tersedia: uji calon pengguna, perbaiki gangguan kecil, lengkapi bukti. | Gunakan hasil terukur; jangan membuka scope baru. |
| 15:00-15:30 | Latihan pitch Inggris, Q&A, dan persiapan cadangan. | Bekukan versi demo setelah pemeriksaan akhir. |
| Sebelum 16:00 | Kirim form dan periksa tautan publik. | Simpan bukti submission; jangan menunggu 16:30. |

Jika waktu efektif hanya tiga jam, fitur tambahan dibatalkan. Pakai 14:30 sebagai batas build dan sisa waktu yang tersedia untuk pengiriman serta latihan.

### Urutan dependensi

1. Sepakati sumber profil pengguna, katalog, dan endpoint rekomendasi yang benar-benar digunakan UI.
2. Terapkan filter wajib dan hasil kandidat kosong sebelum menyempurnakan penjelasan AI.
3. Pastikan pembaruan memori tersimpan sebelum UI meminta rekomendasi ulang.
4. Validasi pilihan AI terhadap kandidat sebelum menambahkannya ke keranjang.
5. Backend menyimpan order sebelum UI menampilkan sukses.
6. Ukur versi terintegrasi sebelum memasukkan hasil ke pitch.

Jangan memelihara dua jalur rekomendasi dengan aturan berbeda. Jika hero recommendation dan daftar ranking tetap digunakan, keduanya harus mengikuti batas wajib dan preferensi terbaru yang sama.

## Kontrak minimum alur aplikasi

Nama operasi berikut adalah batas tanggung jawab, bukan kewajiban membuat endpoint baru. Gunakan modul yang sudah tersedia agar implementasi tetap kecil.

| Operasi | Tanggung jawab | Hasil yang harus dapat diperiksa |
| --- | --- | --- |
| Baca profil | Backend mengambil data user yang aktif. | Anggaran, pantangan, preferensi, dan identitas user konsisten. |
| Cari kandidat | Backend mengambil menu tersedia dan memfilter batas wajib. | Daftar ID kandidat atau status tidak ada kandidat. |
| Pilih dan jelaskan | AI memilih dari kandidat; backend memvalidasi hasilnya. | ID menu valid dan alasan sesuai atribut katalog. |
| Perbarui preferensi | Sistem mengekstrak pernyataan pengguna dan menyimpannya. | Fakta tersimpan, sumber pernyataan, serta status selesai atau gagal. |
| Rekomendasi ulang | Sistem membaca preferensi terbaru setelah penyimpanan selesai. | Pilihan dan alasan mencerminkan perubahan. |
| Siapkan order | Backend memvalidasi item, ketersediaan, harga, dan merchant. | Ringkasan order simulasi sebelum konfirmasi. |
| Konfirmasi order | Pengguna menyetujui; backend menyimpan transaksi. | Order ID persisten atau error yang ditangani UI. |

Untuk demo, pisahkan pantangan wajib dari preferensi sementara. Pernyataan "hari ini tidak ingin ayam" tidak boleh disimpan sebagai alergi atau larangan permanen. Simpan cakupan waktu jika didukung; jika belum, gunakan pernyataan preferensi berkelanjutan yang jelas dan nyatakan batas implementasinya.

Riwayat chat atau pernyataan "saya ingat" dari AI tidak cukup menjadi bukti penyimpanan. Tunjukkan data tersimpan dan dampaknya pada hasil berikutnya.

## Skenario penerimaan wajib

Siapkan akun dan data khusus demo. Jangan memakai data pengguna lain atau mengubah data bersama secara sembarangan.

| ID | Skenario | Kriteria lulus | Pemilik verifikasi |
| --- | --- | --- | --- |
| A1 | Meminta makan siang maksimal Rp30.000 dengan katalog yang memadai. | Pilihan tersedia dan memenuhi batas biaya yang dijanjikan. Jelaskan apakah anggaran mencakup ongkir dan biaya layanan. | William |
| A2 | Menambahkan pantangan eksplisit. | Menu yang melanggar tidak muncul pada rekomendasi maupun swap. | Firman |
| A3 | Menyatakan tidak menyukai ayam dan meminta alternatif. | Preferensi tersimpan, rekomendasi ulang menghormatinya, dan alasan sesuai data. | Yizreel |
| A4 | Refresh setelah A3. | Preferensi tetap berlaku untuk user yang sama. | Prans |
| A5 | Membuka akun demo kedua. | Preferensi dan memori akun pertama tidak terbawa. | Firman |
| A6 | Semua kandidat melanggar batas wajib. | Sistem menjelaskan tidak ada pilihan sesuai tanpa mengembalikan kandidat terlarang. | Firman |
| A7 | Model gagal atau memberi ID menu di luar kandidat. | Backend menolak hasil tidak valid; UI menjelaskan error atau fallback dengan benar. | Yizreel |
| A8 | Menyelesaikan checkout simulasi. | Order tersimpan, detail sesuai keranjang, dan UI menampilkan ID hasil backend. | Prans |
| A9 | Backend order gagal atau request diulang. | Tidak ada sukses palsu, keranjang tetap ada saat gagal, dan tidak terbentuk order ganda. | Firman |
| A10 | Menu menjadi tidak tersedia. | Sistem tidak memilihnya kembali; checkout memeriksa ulang ketersediaan. | William |

Jika data alergen atau nutrisi belum lengkap, tampilkan status belum terverifikasi. Jangan menjadikan ketiadaan data sebagai bukti aman.

## Evaluasi adaptasi dan nilai produk

Evaluasi ini membuktikan perilaku produk; tidak mengklaim pelatihan ulang model atau manfaat kesehatan klinis.

1. Siapkan minimal lima skenario tetap dengan katalog yang sama dan kandidat sesuai yang cukup.
2. Bandingkan hasil tanpa personalisasi, dengan profil awal, dan setelah feedback eksplisit tersimpan.
3. Ubah hanya informasi profil atau feedback yang sedang diuji. Jika ranking acak, gunakan seed yang sama atau matikan variasi acak saat evaluasi.
4. Catat kepatuhan batas wajib, pelanggaran preferensi, validitas ID menu, latency, dan kegagalan.
5. Pisahkan pengujian backend deterministik dari pengujian yang benar-benar memanggil OpenAI API.
6. Laporkan jumlah kasus dan hasil aktual. Lima skenario adalah uji prototipe, bukan bukti generalisasi ke seluruh pengguna.

Target penerimaan internal:

- Tidak ada pelanggaran batas wajib pada skenario yang diuji.
- Seluruh ID menu hasil AI valid setelah validasi server.
- Feedback eksplisit diterapkan pada seluruh skenario yang relevan.
- Tidak ada sukses palsu pada kasus order gagal.
- Alur demo berhasil dua kali berturut-turut setelah integrasi terakhir.
- Latency dicatat sebagai hasil pengukuran; jangan menjanjikan waktu respons yang belum terbukti.

Jika ada tiga calon pengguna yang tersedia, minta mereka memilih makanan dengan dan tanpa NutriSea pada tugas sebanding. Catat waktu, jumlah koreksi, keberhasilan, dan komentar. Nyatakan ukuran sampel serta keterbatasannya. Jangan menghambat perbaikan inti demi studi pengguna.

## Cara kerja tim dengan Codex

Setiap anggota memakai sesi Codex untuk area tugasnya. Tim tetap menentukan scope, mereview hasil, dan menggabungkan perubahan. Tidak perlu mengaktifkan sistem multi-agent baru untuk menyelesaikan rencana ini.

### Konteks tugas

Berikan NUTRISEA_BUILD.md, bagian SPECS.md yang relevan, file yang boleh diubah, dan acceptance criteria. Hindari permintaan umum seperti "buat lebih bagus".

Contoh tugas backend:

```text
Baca NUTRISEA_BUILD.md dan SPECS.md bagian P0.1.
Perbaiki rekomendasi dan swap agar batas wajib tidak dapat dilewati.
Saat kandidat kosong, kembalikan status eksplisit tanpa kandidat terlarang.
Validasi pilihan AI terhadap ID kandidat.
Tambahkan pengujian regresi untuk kandidat kosong, swap, dan ID tidak valid.
Jangan mengubah UI atau melakukan migrasi framework.
Laporkan perubahan, perintah verifikasi, hasil, dan batas yang tersisa.
```

Contoh tugas frontend:

```text
Baca SPECS.md bagian P0.2 dan P1.4.
Perbaiki checkout agar sukses hanya muncul setelah order backend valid.
Pertahankan keranjang saat gagal dan gunakan konfigurasi API bersama.
Gunakan detail item dan merchant yang dipilih pengguna.
Verifikasi kasus sukses, HTTP error, dan jaringan gagal.
Jangan menambah fitur pembayaran atau merombak desain.
```

Contoh tugas AI dan memori:

```text
Telusuri chat, ekstraksi memori, dan jalur rekomendasi yang digunakan UI.
Pastikan preferensi eksplisit tersimpan pada user yang benar dan dipakai
setelah penyimpanan selesai. Koreksi terbaru harus mengungguli preferensi lama.
Verifikasi perubahan rekomendasi, persistensi setelah refresh, dan isolasi user.
Jangan menyamakan preferensi makanan dengan alergi.
```

Contoh tugas review:

```text
Review diff terhadap skenario A1 sampai A10 tanpa mengedit kode terlebih dahulu.
Prioritaskan bypass pantangan, sukses palsu, kebocoran memori antar-user,
dan klaim simulasi yang menyesatkan. Laporkan temuan dengan file,
lokasi, dampak, dan cara reproduksi. Bedakan temuan pasti dari dugaan.
```

### Bukti kontribusi Codex

William mengumpulkan catatan kontribusi dari setiap anggota dalam satu tabel kerja. Gunakan sesi, diff, commit, atau PR yang benar-benar ada.

| Tugas | Pemilik | Kontribusi Codex | Bukti perubahan | Verifikasi aktual | Koreksi atau keputusan manusia |
| --- | --- | --- | --- | --- | --- |
| Filter dan swap | Firman | Diisi setelah pekerjaan | Diff atau PR | Perintah dan hasil | Keputusan reviewer |
| Memori adaptif | Yizreel | Diisi setelah pekerjaan | Diff atau PR | Skenario sebelum dan sesudah | Keputusan reviewer |
| Checkout | Prans | Diisi setelah pekerjaan | Diff atau PR | Kasus sukses dan gagal | Keputusan reviewer |
| Review integrasi | William | Diisi setelah pekerjaan | Temuan dan perbaikan | Hasil penerimaan | Scope yang diterima atau ditolak |

Untuk pitch, pilih dua atau tiga kontribusi paling kuat. Jelaskan masalah, bantuan Codex, cara tim memvalidasi, dan hasilnya. Jangan mengarang jumlah prompt, penghematan waktu, atau persentase kode.

## Batas fitur dan rencana cadangan

| Kondisi | Keputusan |
| --- | --- |
| Memori belum mengubah rekomendasi saat integrasi pertama | Hentikan semua fitur tambahan. AI dan backend fokus menyelesaikan satu jalur tersebut. |
| Scanner atau rekalibrasi belum dinamis | Keluarkan dari demo utama; jangan menjadikannya bukti adaptasi. |
| SeaBank atau merchant insights masih sintetis | Labeli sebagai simulasi dan hindari klaim dampak finansial atau bisnis nyata. |
| API tidak tersedia | Tampilkan status jujur; gunakan fallback deterministik berlabel untuk menunjukkan alur yang masih berjalan. |
| Internet lokasi gagal | Gunakan demo lokal bila memungkinkan dan rekaman versi terakhir sebagai cadangan yang disebut sebagai rekaman. |
| Demo online belum stabil | Utamakan demo lokal yang teruji. Tautan demo opsional; repository dan writeup tetap wajib. |
| Waktu habis sebelum semua acceptance criteria lulus | Catat kegagalan dan persempit klaim. Jangan menampilkan fitur gagal sebagai berhasil. |

Rekam satu demo berhasil setelah versi stabil tersedia. Periksa bahwa rekaman tidak menampilkan API key, data pribadi, atau informasi akun sensitif.

## Bahan akhir dan penanggung jawab

| Bahan | Pemilik | Isi minimum |
| --- | --- | --- |
| Versi demo | William bersama seluruh engineer | Commit atau versi yang teridentifikasi, setup yang teruji, data demo yang siap. |
| README | Firman | Setup, environment contoh, perintah menjalankan dan menguji, batas integrasi. |
| Project writeup | William | Masalah, solusi, build direction, bukti demo, penggunaan Codex, hasil evaluasi, keterbatasan. |
| Deklarasi | William dengan konfirmasi seluruh anggota | OSS, sumber data, asal pekerjaan hari kompetisi, dan komponen simulasi. |
| Bukti Codex dan evaluasi | Yizreel dan William | Kontribusi nyata, hasil pengujian, serta contoh adaptasi sebelum dan sesudah. |
| Pitch Inggris | William dan Yizreel | Presentasi 6 menit, pembagian pembicara, serta jawaban Q&A. |
| Form submission | William | Tautan publik yang dapat diakses dan bukti pengiriman sebelum deadline. |

## Status pekerjaan tim

Isi status dengan Belum, Berjalan, Terverifikasi, atau Dibatalkan. Status Terverifikasi memerlukan bukti hasil; tabel ini bukan pernyataan bahwa pekerjaan sudah selesai.

| Pekerjaan | Pemilik | Status awal | Bukti atau penghambat |
| --- | --- | --- | --- |
| Baseline dan kontrak alur | William | Belum | Diisi tim |
| Filter dan swap konsisten | Firman | Belum | Diisi tim |
| Memori mengubah rekomendasi | Yizreel | Belum | Diisi tim |
| Validasi hasil AI | Yizreel | Belum | Diisi tim |
| Checkout akurat | Prans dan Firman | Belum | Diisi tim |
| Label simulasi dan API URL | Prans | Belum | Diisi tim |
| Evaluasi A1 sampai A10 | William | Belum | Diisi tim |
| Bukti penggunaan Codex | Semua; dihimpun William | Belum | Diisi tim |
| Dokumen dan deklarasi | William | Belum | Diisi tim |
| Rehearsal dan cadangan | William dan Yizreel | Belum | Diisi tim |
| Pengiriman form | William | Belum | Diisi tim |
