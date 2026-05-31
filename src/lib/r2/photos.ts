import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './client'
import { appConfig } from '@/config/app-config'

export async function uploadPhotoToR2(
  sessionId: string,
  frameIndex: number,
  blob: Blob,
): Promise<string | null> {
  const client = getR2Client()
  if (!client) {
    console.warn('[r2] client not configured')
    return null
  }

  const path = `${sessionId}/frames/frame_${frameIndex}.jpg`
  const startTime = Date.now()

  try {
    const buffer = await blob.arrayBuffer()
    const command = new PutObjectCommand({
      Bucket: appConfig.r2.bucketName,
      Key: path,
      Body: new Uint8Array(buffer),
      ContentType: 'image/jpeg',
    })

    await client.send(command)
    const elapsed = Date.now() - startTime
    console.info('[r2] upload complete', { sessionId, frameIndex, path, duration: elapsed })
    return path
  } catch (err) {
    const elapsed = Date.now() - startTime
    console.error('[r2] upload failed', {
      sessionId,
      frameIndex,
      path,
      duration: elapsed,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export async function uploadComposedToR2(
  sessionId: string,
  blob: Blob,
): Promise<string | null> {
  const client = getR2Client()
  if (!client) {
    console.warn('[r2] client not configured')
    return null
  }

  const path = `${sessionId}/composed/final.jpg`
  const startTime = Date.now()

  try {
    const buffer = await blob.arrayBuffer()
    const command = new PutObjectCommand({
      Bucket: appConfig.r2.bucketName,
      Key: path,
      Body: new Uint8Array(buffer),
      ContentType: 'image/jpeg',
    })

    await client.send(command)
    const elapsed = Date.now() - startTime

    // Return public URL if configured, otherwise return path for presigned URL generation
    const url = appConfig.r2.publicUrl
      ? `${appConfig.r2.publicUrl}/${path}`
      : path

    console.info('[r2] composed upload complete', { sessionId, path, duration: elapsed, url })
    return url
  } catch (err) {
    const elapsed = Date.now() - startTime
    console.error('[r2] composed upload failed', {
      sessionId,
      path,
      duration: elapsed,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export async function uploadLiveAssetToR2(
  sessionId: string,
  blob: Blob,
  ext: string,
): Promise<string | null> {
  const client = getR2Client()
  if (!client) {
    console.warn('[r2] client not configured')
    return null
  }

  const path = `${sessionId}/live/live.${ext}`
  const startTime = Date.now()

  try {
    const buffer = await blob.arrayBuffer()
    const contentType = ext === 'gif' ? 'image/gif' : 'video/webm'
    const command = new PutObjectCommand({
      Bucket: appConfig.r2.bucketName,
      Key: path,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
    })

    await client.send(command)
    const elapsed = Date.now() - startTime

    // Return public URL if configured, otherwise return path for presigned URL generation
    const url = appConfig.r2.publicUrl
      ? `${appConfig.r2.publicUrl}/${path}`
      : path

    console.info('[r2] live asset upload complete', { sessionId, path, duration: elapsed, url })
    return url
  } catch (err) {
    const elapsed = Date.now() - startTime
    console.error('[r2] live asset upload failed', {
      sessionId,
      path,
      duration: elapsed,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export async function getR2SignedUrl(
  path: string,
  expiresIn: number = 604800, // 7 days in seconds
): Promise<string | null> {
  const client = getR2Client()
  if (!client) {
    console.warn('[r2] client not configured')
    return null
  }

  try {
    const command = new GetObjectCommand({
      Bucket: appConfig.r2.bucketName,
      Key: path,
    })

    const url = await getSignedUrl(client, command, { expiresIn })
    return url
  } catch (err) {
    console.error('[r2] presigned URL generation failed', {
      path,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
