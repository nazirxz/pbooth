import { S3Client } from '@aws-sdk/client-s3'
import { appConfig } from '@/config/app-config'

let client: S3Client | null = null

export function getR2Client(): S3Client | null {
  if (!appConfig.r2.accessKeyId || !appConfig.r2.secretAccessKey) {
    return null
  }

  if (!client) {
    client = new S3Client({
      region: appConfig.r2.region,
      endpoint: appConfig.r2.endpoint,
      credentials: {
        accessKeyId: appConfig.r2.accessKeyId,
        secretAccessKey: appConfig.r2.secretAccessKey,
      },
    })
  }

  return client
}

export function r2Ready(): boolean {
  return getR2Client() !== null
}
