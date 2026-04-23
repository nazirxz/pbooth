import { appConfig } from '@/config/app-config'
import { WebcamSource } from './webcam-source'
import { DslrSource } from './dslr-source'
import type { CameraSource } from './types'

export function createCameraSource(): CameraSource {
  return appConfig.camera.source === 'dslr' ? new DslrSource() : new WebcamSource()
}

export type { CameraSource } from './types'
