import { appConfig } from '@/config/app-config'
import { getSelectedDeviceId } from '@/state/device-store'
import type { CameraSource } from './types'

export class WebcamSource implements CameraSource {
  readonly name = 'webcam'
  private stream: MediaStream | null = null

  async start(): Promise<MediaStream> {
    if (this.stream) return this.stream
    const deviceId = getSelectedDeviceId()
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: appConfig.camera.webcam.width },
      height: { ideal: appConfig.camera.webcam.height },
    }
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    } else {
      videoConstraints.facingMode = appConfig.camera.webcam.facingMode
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })
    } catch (e) {
      // Stored deviceId no longer valid (cable unplugged etc.) — fall back to default.
      if (deviceId) {
        console.warn('[camera] selected device unavailable, falling back to default', e)
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: appConfig.camera.webcam.facingMode,
            width: { ideal: appConfig.camera.webcam.width },
            height: { ideal: appConfig.camera.webcam.height },
          },
          audio: false,
        })
      } else {
        throw e
      }
    }
    console.info('[camera/webcam] stream ready', describeStream(this.stream))
    return this.stream
  }

  async capture(videoEl: HTMLVideoElement): Promise<Blob> {
    await waitForVideoFrame(videoEl, 4_000)
    if (videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
      throw new Error(
        `Cannot capture webcam frame: video size is ${videoEl.videoWidth}x${videoEl.videoHeight}`,
      )
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    // Mirror (selfie) to match what user sees in preview.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    try {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
    } catch (e) {
      throw new Error(
        `Cannot draw webcam frame to canvas: ${(e as Error)?.message ?? String(e)} ` +
          `(readyState=${videoEl.readyState}, size=${videoEl.videoWidth}x${videoEl.videoHeight})`,
      )
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) {
          reject(new Error('webcam canvas.toBlob returned null'))
          return
        }
        if (b.size <= 0) {
          reject(new Error('webcam canvas.toBlob returned an empty blob'))
          return
        }
        resolve(b)
      }, 'image/jpeg', 0.92)
    })

    console.info('[camera/webcam] captured frame', {
      videoWidth: videoEl.videoWidth,
      videoHeight: videoEl.videoHeight,
      readyState: videoEl.readyState,
      blobBytes: blob.size,
      blobType: blob.type || '(unknown)',
    })
    return blob
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }
}

async function waitForVideoFrame(videoEl: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (videoEl.paused) {
    try {
      await videoEl.play()
    } catch (e) {
      console.warn('[camera/webcam] video.play() failed before snapshot', e)
    }
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0 && videoEl.readyState >= 2) return
    await wait(50)
  }

  throw new Error(
    `Timed out waiting for a usable video frame ` +
      `(readyState=${videoEl.readyState}, size=${videoEl.videoWidth}x${videoEl.videoHeight})`,
  )
}

function describeStream(stream: MediaStream | null) {
  if (!stream) return null
  return stream.getTracks().map((track) => ({
    kind: track.kind,
    label: track.label,
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    settings: track.getSettings(),
  }))
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
