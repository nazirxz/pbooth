import { appConfig } from '@/config/app-config'
import { DigiCamClient } from './digicam-client'
import { WebcamSource } from './webcam-source'
import type { CameraSource } from './types'

/**
 * Canon EOS tethered source backed by digiCamControl.
 *
 * COMPATIBILITY: Supported Canon DSLRs (EOS 800D, 1500D, 90D, 5D…) and
 * R-series mirrorless (R50, R10, R8…). NOT compatible with EOS M-series
 * (M3/M5/M10) — Canon never released a tether SDK for those bodies; for an
 * M3 kiosk use the webcam/HDMI capture path instead. See docs/kiosk-setup-800d.md
 * for the EOS 800D rig, and docs/kiosk-setup-guide.md section L for the M3 path.
 *
 * EOS 800D NOTE: exposure mode is the physical top dial (EDSDK can't move it)
 * and the pop-up flash must be raised by hand — see start()'s mode diagnostic.
 *
 * Architecture:
 *  - Live preview comes from an HDMI capture card surfaced as a USB video
 *    device — same `getUserMedia` path the webcam uses. The user picks the
 *    capture device in Settings; deviceId is read here on start().
 *  - Stills come from a tethered USB connection to the Canon body. We hit
 *    digiCamControl's HTTP API to set manual mode parameters, fire the
 *    shutter, wait for the file, and download the JPEG.
 *
 * `videoEl` is ignored on capture — it's the HDMI preview, not the real
 * sensor, and we want flash-illuminated, manual-mode stills from the body.
 *
 * Fallback: when digiCamControl is unreachable (dev machine, kabel kebalik,
 * service mati), and `dslr.fallbackToWebcam` is true, we degrade to a
 * webcam-style canvas snapshot so the UI keeps working without hardware.
 */
export class DslrSource implements CameraSource {
  readonly name = 'dslr'

  private client = new DigiCamClient(
    appConfig.camera.dslr.apiUrl,
    appConfig.camera.dslr.captureTimeoutMs
  )
  private preview = new WebcamSource()
  private apiReady = false
  private lastCapturedPath: string | null = null

  async start(): Promise<MediaStream> {
    // Preview track first — even if digiCamControl is down we want pose
    // feedback so the operator can diagnose the rig.
    const stream = await this.preview.start()

    this.apiReady = await this.client.ping()
    if (!this.apiReady) {
      if (appConfig.camera.dslr.fallbackToWebcam) {
        console.warn(
          '[camera/dslr] digiCamControl not reachable at',
          appConfig.camera.dslr.apiUrl,
          '— capture will fall back to HDMI/webcam snapshot.',
        )
      } else {
        throw new Error(
          `digiCamControl not reachable at ${appConfig.camera.dslr.apiUrl}. ` +
            'Launch digiCamControl and enable its webserver, or set ' +
            'VITE_DCC_FALLBACK=true to allow webcam-only capture.',
        )
      }
    } else {
      await this.warnIfWrongMode()
      await this.applyManualSettings()
    }

    // Capture device may have changed since last session — refresh the
    // baseline so we can detect the next shutter's file even on first shot.
    this.lastCapturedPath = await this.readLastCaptured()

    return stream
  }

  async capture(videoEl: HTMLVideoElement): Promise<Blob> {
    if (!this.apiReady) return this.preview.capture(videoEl)

    try {
      await this.client.capture()
      const path = await this.client.waitForNewCapture(
        this.lastCapturedPath,
        appConfig.camera.dslr.captureTimeoutMs,
      )
      this.lastCapturedPath = path
      return await this.client.downloadImage(path)
    } catch (e) {
      if (appConfig.camera.dslr.fallbackToWebcam) {
        console.warn('[camera/dslr] tether capture failed, falling back to preview snapshot', e)
        return this.preview.capture(videoEl)
      }
      throw e
    }
  }

  stop(): void {
    this.preview.stop()
    this.apiReady = false
    this.lastCapturedPath = null
  }

  /**
   * The EOS 800D's exposure mode lives on the physical top dial — EDSDK can't
   * move it. If the operator left it on Movie/Auto/P our manual ISO/shutter/
   * aperture won't stick, and in Movie the flash won't fire at all (the exact
   * "mode video" bug we're fixing). Read it once and warn loudly; never abort —
   * the operator can turn the dial to M and the next session picks it up.
   */
  private async warnIfWrongMode(): Promise<void> {
    const mode = await this.client.getProperty('autoexposuremode')
    if (mode === null) return // unreadable on this body — skip the diagnostic
    if (!/^m(anual)?$/i.test(mode)) {
      console.warn(
        `[camera/dslr] exposure mode is "${mode}", not Manual. ` +
          'Putar mode dial 800D ke M — manual exposure & pop-up flash tidak akan ' +
          'benar di mode lain. Pastikan juga pop-up flash sudah diangkat.',
      )
    }
  }

  private async applyManualSettings(): Promise<void> {
    const { iso, shutter, aperture, whitebalance } = appConfig.camera.dslr.capture
    // Each setProperty can fail per-camera (label mismatches between models),
    // so we attempt each independently and warn rather than abort the session.
    for (const [name, value] of [
      ['isonumber', iso],
      ['shutterspeed', shutter],
      ['aperture', aperture],
      ['whitebalance', whitebalance],
    ] as const) {
      try {
        await this.client.setProperty(name, value)
      } catch (e) {
        console.warn(`[camera/dslr] could not apply ${name}=${value}`, e)
      }
    }
  }

  /** Best-effort snapshot of digiCamControl's "last captured" path. */
  private async readLastCaptured(): Promise<string | null> {
    try {
      // Reusing waitForNewCapture with a tiny timeout would throw — we
      // just want the current value, so peek by passing an unmatchable
      // sentinel. Easier: do a single fetch via a private helper.
      // For simplicity, swallow the throw and treat as no baseline.
      return await this.client.waitForNewCapture(null, 250)
    } catch {
      return null
    }
  }
}
