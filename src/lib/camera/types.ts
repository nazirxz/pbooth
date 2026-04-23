export interface CameraSource {
  readonly name: string
  start(): Promise<MediaStream>
  capture(videoEl: HTMLVideoElement): Promise<Blob>
  stop(): void
}
