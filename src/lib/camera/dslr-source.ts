import type { CameraSource } from './types'

// TODO(fase-3): implement DSLR tethering.
// Options:
//   - gphoto2 via child_process (cross-platform, solid for Canon/Nikon)
//   - Canon EDSDK (Windows-first, official)
//   - Nikon SDK
// Live view akan datang sebagai MJPEG/JPEG stream yang dibungkus jadi MediaStream
// (via canvas captureStream) supaya UI bisa pakai interface yang sama dengan webcam.
export class DslrSource implements CameraSource {
  readonly name = 'dslr'

  async start(): Promise<MediaStream> {
    throw new Error('DSLR source not yet implemented. Use webcam source for PoC.')
  }

  async capture(): Promise<Blob> {
    throw new Error('DSLR capture not yet implemented.')
  }

  stop(): void {}
}
