# Panduan Setup Kiosk Pbooth — Canon EOS 800D (Manual + Pop-up Flash)

Panduan rig **Canon EOS 800D** dengan **capture tether sungguhan** via digiCamControl:
foto diambil dengan **shutter mekanik betulan** → **pop-up flash nyala** dan hasilnya **JPEG full-res**
(bukan grab frame video). HDMI capture card tetap dipakai, **hanya untuk live preview**.

> Ini menggantikan pendekatan EOS M3 di [`kiosk-setup-guide.md`](kiosk-setup-guide.md) (HDMI grab, tanpa flash).
> 800D **didukung penuh** digiCamControl/Canon EDSDK, jadi `DslrSource` di repo langsung jalan.

> **Estimasi waktu**: 60–90 menit untuk operator yang sudah biasa.

---

## Konsep penting (baca dulu)

1. **Flash hanya nyala saat still capture tether**, bukan saat live view. Setup lama (mode video / grab
   HDMI) tidak akan pernah bisa flash — itu sebabnya kita pindah ke tether.
2. **Manual mode = mode dial fisik ke M.** Software **tidak bisa** memutar dial 800D. App hanya set
   ISO/shutter/aperture/WB *setelah* dial di M. Kalau dial salah, Pbooth memunculkan warning di console.
3. **Pop-up flash harus diangkat manual** (tekan tombol flash di samping body). Di mode M flash tidak
   auto-pop. Begitu terangkat, fire tiap jepret.
4. **Flash X-sync 800D = 1/200s.** Shutter > 1/200 dengan flash → pita hitam. Pakai **1/125–1/160**.
5. **Dua koneksi ke PC bersamaan**: USB (tether → shutter+flash+settings) **dan** HDMI→capture card (preview).

---

## A. Hardware

| Item | Spesifikasi | Catatan |
|---|---|---|
| Mini PC Windows | Win 10/11 64-bit, RAM ≥ 8 GB, SSD ≥ 256 GB | digiCamControl Windows-only |
| Monitor touchscreen | 21–24", **1920×1080 landscape** | USB touch + HDMI |
| Canon EOS 800D | Body + lensa kit (18–55mm) | |
| DC coupler + AC adapter | **DR-E18** (coupler LP-E17) + **ACK-E18** | Wajib utk kiosk 24/7 |
| Kabel USB tether | USB bawaan Canon (ke digital terminal 800D) | Untuk fire shutter + set parameter + download foto |
| Kabel HDMI | Sesuaikan konektor HDMI body 800D → HDMI-A | Ke capture card (preview saja) |
| HDMI capture card | USB capture (Elgato Cam Link / MS2109) | Muncul sbg "USB Video Device" |
| Printer DNP | DS620 / DS-RX1HS | Nama di Windows harus mengandung "DNP" |
| Tripod / bracket | Stabil, setinggi mata customer | |
| Diffuser pop-up / bounce card | Opsional tapi disarankan | Lembutkan cahaya flash frontal |
| UPS / stabilizer | Min 600VA | Cegah corrupt saat listrik mati |

---

## B. Setting kamera EOS 800D (WAJIB)

1. Pasang lensa, pasang **DC coupler DR-E18** + colok **ACK-E18** ke listrik, nyalakan kamera.
2. **Putar mode dial ke M (Manual)** — bukan video, bukan Auto.
3. **Angkat pop-up flash** (tekan tombol flash di samping). Kalau tidak diangkat → flash tidak fire.
4. **MENU**:
   - **Auto power off → Disable**
   - **Image quality → JPEG Large Fine** (RAW bikin download lambat / timeout)
   - **Drive mode → Single shooting**
   - **AF → One-Shot**, AF point center — atau **switch lensa ke MF** dan kunci fokus di jarak booth
     (lebih reliabel di lampu redup, tidak hunting)
   - **HDMI output → aktif**; tekan **DISP/INFO** sampai overlay info hilang (feed capture card bersih)
   - **Flash exposure compensation → −1/3 s/d −1** bila pop-up terlalu keras di wajah
5. Parameter awal (atur via dial body, harus cocok dengan `.env` di section E):
   - **ISO 400** · **Shutter 1/125** (≤ 1/200 wajib utk flash) · **Aperture f/5.6** · **WB Flash**
6. Jarak customer **~1.5–2.5 m** dari kamera supaya pop-up flash cukup menjangkau di ISO 400 f/5.6.

---

## C. Install & setting digiCamControl (Windows)

1. Install digiCamControl (versi terbaru) di mini PC.
2. Colok **USB tether** 800D → PC. Buka digiCamControl → pastikan **800D muncul** di daftar kamera.
3. **File → Settings → Webserver → enable** (port default **5513**).
4. Set **Session → folder simpan** ke folder lokal, **format JPEG**.
5. **Matikan/abaikan jendela Live View digiCamControl** — preview kita ambil dari HDMI capture card,
   bukan dari tether (menghindari rebutan live view dengan capture).
6. Test cepat di browser: buka `http://localhost:5513/?slc=capture&param1=&param2=` → kamera harus jepret.

---

## D. Kabel ke mini PC (dua-duanya sekaligus)

1. **USB**: 800D → port USB mini PC (tether, untuk shutter + flash + settings + download).
2. **HDMI**: 800D → capture card → port USB mini PC (preview). Verifikasi "USB Video Device" muncul
   di Windows Camera app, feed live view 800D kelihatan.

---

## E. Konfigurasi Pbooth

Edit `.env.production` di folder install Pbooth:

```env
# 800D via digiCamControl tether (manual mode + pop-up flash, full-res)
VITE_CAMERA_SOURCE=dslr
VITE_DCC_URL=http://localhost:5513
VITE_DCC_ISO=400
VITE_DCC_SHUTTER=1/125      # WAJIB <= 1/200 (flash X-sync 800D); 1/160 juga aman
VITE_DCC_APERTURE=5.6
VITE_DCC_WB=Flash
VITE_DCC_FALLBACK=true      # booth tetap jalan (degrade ke snapshot HDMI tanpa flash)
                            # kalau digiCamControl mati; warning tetap muncul di console

# (lengkapi env Payment / Supabase / R2 sesuai instruksi developer)
```

Jalankan Pbooth → **Settings** → pilih video device **"USB Video Device"** (capture card), Save.

---

## F. Daily checklist (sebelum buka)

- [ ] Mode dial di **M** (bukan video/Auto)
- [ ] **Pop-up flash terangkat**
- [ ] DC coupler tercolok listrik, auto power off Disable
- [ ] digiCamControl jalan, webserver on, 800D terdeteksi
- [ ] HDMI capture card terdeteksi, live preview muncul di Pbooth
- [ ] Test 1 sesi penuh: tiap jepret **flash nyala** + foto full-res masuk + print kebacaan
- [ ] Cek DevTools console: tidak ada warning "exposure mode not Manual" / "fall back to HDMI snapshot"

---

## G. Best practice photobooth (ringkas)

- **Manual mode** supaya exposure tidak berubah-ubah antar customer (kunci utama foto konsisten).
- **Shutter ≤ 1/200** (sync) dan **WB Flash** untuk warna konsisten.
- Pop-up flash itu **frontal & keras** → pasang **diffuser kecil** atau **bounce card**, dan/atau tambah
  **1 LED fill** dari samping 45° supaya bayangan hidung/pipi tidak tajam.
- **Recycle pop-up flash ~1–3 dtk**: countdown 5 dtk + delay antar-frame sudah cukup, tidak perlu diubah.
- Backdrop polos + jarak customer konsisten ~1.5–2.5 m.
- Upgrade kualitas cahaya nanti: **Speedlite di hotshoe** (bisa di-bounce) atau **studio strobe + trigger**
  — flash tetap fire otomatis lewat shutter tether yang sama, tanpa ubah kode.

---

## H. Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Flash tidak nyala | Pop-up flash belum diangkat; atau app fallback ke snapshot HDMI (cek warning console → digiCamControl mati / 800D tidak terdeteksi) |
| Foto gelap | Flash tidak fire (lihat di atas); naikkan ISO; dekatkan customer (pop-up jangkauannya terbatas) |
| Pita hitam di foto | Shutter > 1/200 — turunkan ke 1/160 / 1/125 (`VITE_DCC_SHUTTER`) |
| Warning "exposure mode not Manual" | Mode dial bukan di M — putar ke **M** |
| "timed out waiting for captured file" | Format kamera RAW (lambat) → set JPEG; cek folder session digiCamControl; perbesar `captureTimeoutMs` |
| Warna belang/kuning | WB belum Flash (`VITE_DCC_WB=Flash`); konsistenkan lampu venue |
| Kamera tidak terdeteksi | Kabel USB longgar; digiCamControl webserver off; kamera tidur (auto power off) |
| Preview hitam/freeze | HDMI / capture card (preview terpisah dari tether) — cek di Windows Camera app dulu |

---

## I. Spesifikasi teknis singkat

- **Capture**: still full-res 800D via tether (digiCamControl), JPEG Large Fine.
- **Preview**: HDMI live view 1080p via capture card (`getUserMedia`), ~30 fps.
- **Flash**: pop-up bawaan, fire tiap shutter tether; sync ≤ 1/200s.
- **Fallback**: bila digiCamControl tak terjangkau → snapshot frame HDMI (tanpa flash, lebih rendah res),
  diatur `VITE_DCC_FALLBACK`.
- **Storage**: lokal + auto-upload (R2/Supabase, sesuai `VITE_STORAGE_BACKEND`).
