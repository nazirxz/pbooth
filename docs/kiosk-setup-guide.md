# Panduan Setup Kiosk Pbooth — Client

Panduan lengkap pemasangan kiosk Pbooth dari nol untuk **Canon EOS M3** via HDMI capture (manual photo mode, tanpa flash). Section akhir membahas path upgrade ke setup ber-flash.

> **Estimasi waktu**: 60–90 menit untuk operator yang sudah biasa, 2–3 jam pertama kali.

> ⚠️ **Catatan kamera**: Canon EOS M3 tidak didukung software tether (digiCamControl, gphoto2 tidak reliable). Setup ini pakai **HDMI capture** — kamera streaming live view ke PC seperti webcam. Cukup untuk kiosk asal lighting venue konsisten.

---

## A. Daftar Hardware

Pastikan semua item ini tersedia sebelum mulai.

### Wajib

| Item | Spesifikasi | Catatan |
|---|---|---|
| Mini PC Windows | Windows 10/11 64-bit, RAM ≥ 8 GB, SSD ≥ 256 GB | Intel NUC / Mini PC ringkas |
| Monitor touchscreen | 21–24", resolusi **1920×1080 landscape** | USB touch + HDMI |
| Canon EOS M3 | Body + lensa kit (15–45mm) | Sudah ada |
| Dummy battery | **Canon DR-E17** + AC adapter **ACK-E17** | Wajib untuk kiosk 24/7 — baterai LP-E17 normal habis dalam 3–4 jam |
| HDMI cable | **Mini HDMI** (Type C) → HDMI-A standar | EOS M3 pakai Mini HDMI di body |
| HDMI capture card | USB capture device (Elgato Cam Link atau MS2109 dongle) | Surfaces sebagai USB Video Device |
| LED continuous lighting | LED panel bi-color 30W atau ring light 18" | **Krusial** — tanpa flash, lighting konsisten = foto bagus |
| Printer DNP | DNP DS620 / DS-RX1HS atau model serupa | Sesuai pilihan client |
| Tripod / mounting bracket | Stabil, posisi camera setinggi mata customer | |
| SD card | SanDisk Class 10 / U3, 32–64 GB | Untuk backup foto di body |
| UPS / stabilizer | Min 600VA | Cegah corrupt saat listrik mati mendadak |

### Optional tapi direkomendasikan

- USB Mini-B cable (kalau ingin transfer file dari SD via USB untuk backup)
- TeamViewer / AnyDesk untuk remote support
- USB hub powered (kalau port PC terbatas)
- Backdrop polos (cloth/paper) untuk konsistensi background
- Cable management organizer

### Tidak dibutuhkan untuk EOS M3 (catatan)

- ~~digiCamControl~~ — tidak support EOS M3
- ~~USB tether shutter cable~~ — tidak applicable (lihat upgrade path section L)
- ~~Speedlite / flash~~ — tidak bisa fire via HDMI capture mode (lihat section L)

---

## B. Setup Camera Canon EOS M3

### B.1 Pasang lensa & power

1. Pasang lensa ke body camera, kunci sampai klik.
2. **Buka kompartemen baterai**, masukkan dummy battery **DR-E17** (bukan baterai LP-E17 normal — DR-E17 adalah DC coupler).
3. Colokkan AC adapter **ACK-E17** ke listrik, sambungkan ke dummy battery.
4. Nyalakan camera dengan power switch.

### B.2 Setting menu camera (WAJIB)

Putar mode dial ke **M (Manual)** — bukan video mode!

Tekan tombol **MENU**, lakukan:

1. **Auto power off** → **Disable** (camera tidak boleh tidur saat operasi)
2. **Image quality** → **JPEG Large Fine**
3. **Drive mode** → **Single shooting** (bukan continuous)
4. **AF mode** → **One-Shot AF**, AF point center
5. **HDMI output** → pastikan aktif (sebagian setting muncul saat HDMI terdeteksi)
6. **Display info** → minimize overlay (hilangkan info di layar supaya HDMI capture clean)

Wi-Fi/NFC boleh **aktif** (tidak akan konflik karena kita tidak USB tether).

Set parameter shooting awal di mode dial M (atur via dial putar di body):

- **ISO**: 400 (atau lebih tinggi 800-1600 untuk indoor venue agak gelap)
- **Shutter speed**: 1/60–1/125 (cukup untuk tangan stabil)
- **Aperture**: f/4 atau f/5.6 (sweet spot kit lens)
- **White balance**: AWB atau set Tungsten/Daylight sesuai lampu venue
- **Metering**: Evaluative

### B.3 Test exposure manual

Sebelum lanjut, test sekali:
1. Arahkan camera ke posisi customer akan berdiri (depan backdrop).
2. Setengah tekan shutter → fokus dapat, layar live view kelihatan exposure yang akan didapat.
3. Adjust ISO/aperture/shutter sampai gambar live view well-exposed (tidak gelap, tidak terlalu terang).
4. Catat setting yang dipakai untuk reference operator.

> **Penting**: lighting venue harus konsisten. Karena kita capture dari HDMI feed (bukan fire shutter), warna & exposure di Pbooth = persis apa yang tampil di layar camera saat itu juga.

---

## C. Setup Lighting (Krusial)

Tanpa flash, lighting venue menentukan kualitas foto. Recommended setup:

### Minimum setup

- **1× LED panel bi-color 30W** atau **1× ring light 18"**
- Posisi: **45° dari customer, setinggi kepala**, jarak ~1.5 m
- Color temperature: **5500K** (daylight) atau sesuai mood venue

### Setup yang lebih baik

- **2× LED panel bi-color** (key + fill) untuk hilangkan bayangan tajam
- **1× LED strip / background light** untuk separation dari backdrop
- Softbox cover di depan LED untuk soften light

### Test lighting

1. Customer berdiri di posisi shoot
2. Lihat live view kamera: muka harus terang merata, tidak ada bayangan tajam di pipi/hidung
3. Background terlihat clean, tidak terlalu gelap
4. Catatan: lighting pagi vs sore bisa beda jika ada window — perhatikan!

---

## D. Pasang Kabel ke Mini PC

> ⚠️ EOS M3 cukup HDMI capture saja untuk operasi. USB tether tidak diperlukan.

### D.1 HDMI capture untuk live view + capture

1. **Camera OFF.**
2. Colok kabel **Mini HDMI (Type C)** dari camera ke HDMI capture card.
3. Colok USB HDMI capture card ke **port USB Mini PC** (utamakan port langsung di motherboard, bukan hub).
4. Windows auto-install driver → muncul "USB Video Device" di Device Manager.
5. **Nyalakan camera** → tunggu live view aktif, output HDMI mulai stream.

### D.2 Verifikasi di Windows

Buka **Device Manager** (Win+X → Device Manager):

- **Sound, video and game controllers** atau **Cameras**: ada "USB Video Device" / "USB Capture" (HDMI dongle)

Test di Windows Camera app:
1. Buka Start → Camera (built-in Windows)
2. Klik ikon switch camera kalau ada multi device
3. Pilih USB capture → harus muncul feed dari EOS M3 live view

---

## E. Install Pbooth (Kiosk App)

### E.1 Install

1. Dapatkan installer `Pbooth-Setup-x.x.x.exe` dari developer.
2. Run installer, install ke default location.
3. Setelah selesai, **JANGAN buka dulu** — lanjut ke konfigurasi.

### E.2 Konfigurasi environment

Buat file `.env.production` di folder install Pbooth (`C:\Program Files\Pbooth\` atau path install):

```env
# Camera source: 'webcam' untuk EOS M3 via HDMI capture
# (jangan pakai 'dslr' — itu untuk camera R-series via digiCamControl, lihat section L)
VITE_CAMERA_SOURCE=webcam

# Payment provider
VITE_PAYMENT_PROVIDER=doku

# (lengkapi env Supabase, R2, Doku sesuai instruksi developer)
```

### E.3 First launch + pilih HDMI source

1. Buka Pbooth dari Start menu / Desktop shortcut.
2. Tunggu hingga splash screen lewat.
3. Masuk ke **Settings** (gear icon atau gesture sesuai UI):
   - Pilih video device → pilih **"USB Video Device"** (HDMI capture card)
   - Bukan "Integrated Camera" atau webcam laptop
4. Save settings → kembali ke home.
5. Test sesi capture lengkap dari home → pastikan foto ter-capture dengan baik.

---

## F. Software Pendukung Lain

Install di Mini PC sebelum operasi:

### F.1 Printer driver DNP

1. Download driver dari https://dnpphoto.com → pilih model printer (DS620 / DS-RX1HS / dll)
2. Install driver
3. Pasang USB printer + listrik + kertas
4. Buka **Settings → Printers & scanners** di Windows → printer harus muncul (mis. "DNP DS620")
5. Test print 1 lembar dari Windows.

> **Catatan**: nama printer di Windows harus mengandung kata "DNP" (sudah dikonfigurasi di `appConfig.printer.deviceName`). Kalau beda, koordinasi dengan developer.

### F.2 Windows updates

Pastikan Windows up-to-date untuk Edge WebView2 (dipakai Electron):
- Settings → Windows Update → Check for updates
- Restart kalau diminta

### F.3 (Opsional) Remote support

- **AnyDesk** atau **TeamViewer** untuk troubleshooting remote
- Set auto-login user yang sama dengan Pbooth runtime

---

## G. Daily Checklist (Sebelum Buka)

Setiap pagi sebelum mulai operasi:

- [ ] Camera ON, live view aktif di layar camera dan HDMI capture
- [ ] Mode dial di **M** (bukan video atau Auto)
- [ ] ISO/shutter/aperture sesuai setting yang dicatat saat setup
- [ ] AC adapter DC coupler tercolok listrik
- [ ] Lensa bersih dari debu / sidik jari
- [ ] LED lighting nyala, terang merata di posisi customer
- [ ] Pbooth app jalan full-screen
- [ ] Printer ON, indikator hijau, kertas terisi
- [ ] Internet OK (ping ke www.google.com)
- [ ] Test 1 sesi penuh sampai cetak — pastikan foto terang merata dan strip kebacaan

---

## H. Troubleshooting Cepat

### Live preview hitam / freeze

- Camera ON? Live view aktif?
- HDMI cable terpasang rapat di sisi camera (port karet sering longgar)?
- HDMI capture card terdeteksi di Settings Pbooth?
- Cabut & colok ulang USB capture card → test di Windows Camera dulu
- Restart Pbooth

### Foto terlalu gelap

- Naikkan ISO di body camera (mis. 400 → 800 → 1600)
- Buka aperture (f/5.6 → f/4 → f/2.8 kalau lensa support)
- Turunkan shutter (1/125 → 1/60 — hati-hati blur kalau customer goyang)
- Tambah LED lighting / dekatkan ke customer

### Foto terlalu terang / blown out

- Turunkan ISO
- Naikkan shutter (1/60 → 1/125 → 1/250)
- Kecilkan aperture (f/4 → f/5.6 → f/8)
- Cek apakah ada cahaya matahari langsung dari window

### Warna foto aneh (terlalu kuning / biru)

- Set white balance manual di camera body sesuai jenis lampu:
  - LED 5500K → Daylight
  - Lampu rumah tungsten → Tungsten
  - Mixed → AWB
- Cek juga LED lighting bi-color settingnya konsisten

### Live view di HDMI ada overlay info camera

- Tekan tombol **DISP** atau **INFO** di camera sampai display info hilang
- Setting di MENU → Display info → minimize

### Camera tidur sendiri

- Auto power off di camera → set **Disable**
- Cek dummy battery & AC adapter terpasang baik

### Foto blur

- Customer terlalu dekat? Ada minimum focus distance
- Lighting kurang → camera pakai shutter lambat → blur tangan
- Naikkan shutter speed minimal 1/60, sebaiknya 1/125

### Print blank / putih

- Cek printer ON dan kertas
- Cek nama printer di Windows mengandung "DNP"
- Test print dari Windows Photo Viewer untuk pastikan printer normal

---

## I. Spesifikasi Teknis Singkat

- **Resolusi capture**: HDMI live view ~1920×1080 (jadi capture kira-kira full HD)
- **Resolusi cetak**: 4R (4×6 inch), DPI ~300 (Pbooth sudah scale dari HD)
- **Live preview**: HDMI 1080p via capture card, ~30 fps
- **Capture method**: snapshot dari frame HDMI (canvas) — instant, no delay
- **Storage foto**: lokal di PC + auto-upload ke Cloudflare R2 (3 hari retention)

---

## J. Kontak Support

Untuk masalah yang tidak terselesaikan dari panduan ini:

- **Hardware camera/printer**: vendor lokal
- **Aplikasi Pbooth**: developer (kontak di kontrak)
- **Network/internet**: ISP / IT internal

Catat selalu:
- Tanggal & jam kejadian
- Screenshot error (Win+Shift+S)
- Log file: `%APPDATA%\Pbooth\logs\` (kalau ada)

---

## K. Spek Konektor & Kabel EOS M3 (Reference)

| Konektor | Tipe | Kabel original Canon | Catatan |
|---|---|---|---|
| Battery | LP-E17 (Li-ion 7.2V 1040mAh) | — | 250 shots per charge — wajib pakai DC coupler |
| DC coupler / dummy | DR-E17 | bundled with ACK-E17 kit | Untuk power kontinu |
| HDMI | **Mini HDMI (Type C)** | — | Ke Standard HDMI-A untuk capture card |
| USB | **USB 2.0 Mini-B (5-pin)** | IFC-400PCU | Untuk file transfer dari SD (opsional) |
| Remote shutter port | 2.5mm sub-mini | RS-60E3 | Untuk upgrade flash trigger (section L) |
| Hot shoe | Canon standard | — | Untuk Speedlite (section L) |

---

## L. Upgrade Path: Flash (Future)

Kalau setelah running ingin tambahkan flash untuk hasil foto lebih punchy, ini path-nya:

### Konsep

EOS M3 tidak bisa ditrigger via software → pakai **wired shutter trigger** hardware:

1. Pasang **Speedlite di hot shoe** kamera (ETT-L atau manual mode)
2. Pasang **kabel 2.5mm shutter** ke port remote camera
3. Wire ke **USB relay module** atau Arduino
4. Pbooth main process kirim serial command → relay close → camera fire shutter dengan flash
5. File hasil shutter tersimpan di SD card → bisa ditarik via USB MTP atau Wi-Fi auto-upload

### Hardware tambahan (~Rp 2 jt)

| Item | Estimasi (Rp) |
|---|---|
| Kabel RS-60E3 (2.5mm sub-mini) | 80–150k |
| USB relay 1-channel | 60–120k |
| Speedlite Godox TT350C | 800k–1.2jt |
| Eneloop AA × 4 + charger | 150k |
| Misc kabel & casing | 50k |
| **TOTAL** | **~1.2–1.7 jt** |

### Code yang perlu ditambah

- `WiredTriggerSource` (extend `WebcamSource`) — pakai HDMI capture untuk preview, USB relay untuk shutter
- Dependency baru: `serialport` (Node.js)
- File watcher untuk download dari SD via MTP

Estimasi dev: 2–3 jam.

### Alternatif: ganti camera ke R-series

Kalau budget memungkinkan dan ingin paling mudah:

- **Canon EOS R50** (~Rp 12–14 jt) — full digiCamControl support
- Code `DslrSource` yang sudah ada di repo langsung jalan, tinggal switch `VITE_CAMERA_SOURCE=dslr`
- Tidak perlu wired trigger sama sekali — flash via software tether

---

## M. Future-ready (Untuk Developer)

Kode Pbooth sudah include `DslrSource` (`src/lib/camera/dslr-source.ts`) yang implement integrasi digiCamControl. **Tidak applicable untuk EOS M3** karena Canon tidak provide tether SDK untuk EOS M-series.

`DslrSource` siap dipakai kalau client nanti upgrade ke:
- Canon EOS R-series (R50, R10, R100, R8, R6, dll)
- Canon DSLR (1500D, 250D, 90D, 5D, 6D, dll)
- Camera lain yang didukung digiCamControl

Tinggal install digiCamControl + enable webserver + set `VITE_CAMERA_SOURCE=dslr`.
