# AnalisaOto — Web Dashboard Analisis & Komparasi Transaksi Harian (ZimaOS Private Edition)

Aplikasi web analitik lokal (100% privat) untuk memproses, mengkategorikan secara adaptif, dan membandingkan performa harian (*Day-over-Day / DoD*) server pulsa, e-wallet, transfer bank, dan PPOB.

---

## Fitur Utama (100% Sesuai Spesifikasi PRD)

1. **Lingkungan Privat Lokal (ZimaOS / Docker)**:
   - Seluruh data transaksi dan kamus aturan kategori disimpan 100% di volume lokal (`/app/data`).
   - Dilengkapi `Dockerfile` *multi-stage build* ringan dan `docker-compose.yml` siap impor 1-klik ke **ZimaOS / CasaOS**.
2. **Opsi Upload Fleksibel**:
   - **Upload Harian (Single Day)**: Unggah 1 file Excel per hari, otomatis terpetakan ke kalender tanggal tersebut.
   - **Upload Multi-Hari / Multi-File (Batch)**: Unggah banyak file sekaligus atau 1 file gabungan multi-hari; sistem otomatis memilah berdasarkan tanggal `Tgl. Entri` (`YYYY-MM-DD`).
3. **Mesin Kategorisasi Modular & Adaptif (Self-Correction Engine)**:
   - **5 Pilar Utama Default**: Transfer Bank & Finansial, Topup E-Wallet & Saldo Digital, Tagihan PPOB & Listrik, Pulsa Reguler & Paket Data Seluler, serta Penjualan Voucher (Fisik/Gesek/Inject).
   - **Uncategorized Interceptor & Safe Staging**: Produk baru yang belum dikenali tidak ditolak melainkan disimpan aman sebagai `[Belum Dikategorikan]` disertai banner peringatan kuning.
   - **Interactive Mapping Guide (Wizard)**: Panduan interaktif untuk memetakan produk baru menggunakan pola **Prefix / Awalan**, **Exact Match**, atau **Modul Supplier**, disertai **Instant Recalculation** tanpa perlu unggah ulang file.
   - **Manajemen Kamus Aturan (CRUD Rules)**: Tambah/edit/hapus kategori & aturan, inspeksi 225+ kode produk terdeteksi, dan fitur *Reset to Default*.
4. **Dashboard Analisis & Komparasi Day-over-Day (DoD)**:
   - **Selektor Periode**: Preset *Kemarin vs Kemarin Lusa*, *Hari Ini vs Kemarin*, *Minggu Ini vs Minggu Lalu*, serta *Selektor Tanggal Kustom* ($D_1$ vs $D_2$).
   - **Executive KPI Summary Cards**: Total Omset Penjualan, Total Transaksi Sukses (*Success Rate*), Total Laba Bersih Server, dan Total Komisi Reseller beserta indikator $\Delta$ nominal & $\%$.
   - **Visualisasi Grafik Komparatif**: *Side-by-Side Category Bar Chart* (dengan fitur Zoom Non-Bank), *Interactive Donut Chart*, dan *Kurva Analisis Jam Sibuk (00:00 – 23:00)*.
   - **Tabel Komparasi Berdampingan (Accordion Drill-Down)**: Ekspansi 3 level dari Kategori Utama $\rightarrow$ Sub-Kategori (BCA, BRI, Mandiri, SeaBank, DANA, GoPay, ShopeePay, OVO, dll) $\rightarrow$ Kode Produk.
   - **Analisis Pertumbuhan (Top Gainers & Losers)**: Top Produk Naik/Turun, Pergerakan Reseller, dan Performa Jalur Modul Supplier.
   - **Audit Kegagalan & Gangguan Operasional**: Pemantauan *Stok Kosong*, *Tujuan Salah*, serta *Produk Gangguan / Timeout*.
   - **One-Click WhatsApp Summary**: Salin laporan harian berformat tebal/miring siap kirim ke WhatsApp Owner / Grup Manajemen.

---

## Cara Menjalankan

### 1. Menjalankan Secara Lokal (Node.js)
```bash
npm install
npm run build
npm start
```
Akses aplikasi di: `http://localhost:3000`

### 2. Deployment di ZimaOS / CasaOS (Docker Compose)
```bash
docker compose up -d --build
```
Atau impor langsung file `docker-compose.yml` melalui **ZimaOS App Store -> Custom Install -> Import Docker Compose**, lalu akses `http://<ip-zimaos>:3000`.
