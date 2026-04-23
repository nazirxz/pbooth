import { appConfig } from '@/config/app-config'
import type { CameraSource } from './types'

export class WebcamSource implements CameraSource {
  readonly name = 'webcam'
  private stream: MediaStream | null = null

  async start(): Promise<MediaStream> {
    if (this.stream) return this.stream
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: appConfig.camera.webcam.facingMode,
        width: { ideal: appConfig.camera.webcam.width },
        height: { ideal: appConfig.camera.webcam.height },
      },
      audio: false,
    })
    return this.stream
  }

  async capture(videoEl: HTMLVideoElement): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    // Mirror (selfie) to match what user sees in preview.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92)
    })
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }
}
