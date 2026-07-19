/**
 * Rotates a captured image blob by the given degrees (0, 90, 180, 270).
 * Returns the original blob unchanged if rotation is 0.
 *
 * This handles the common case where the DSLR or HDMI capture card is
 * mounted in a different orientation than the photo strip layout expects.
 */
export async function rotateBlobIfNeeded(
  blob: Blob,
  degrees: 0 | 90 | 180 | 270,
): Promise<Blob> {
  if (degrees === 0) return blob

  const img = await loadImage(blob)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // For 90° and 270°, swap width and height
  if (degrees === 90 || degrees === 270) {
    canvas.width = img.height
    canvas.height = img.width
  } else {
    canvas.width = img.width
    canvas.height = img.height
  }

  ctx.save()
  // Move to center, rotate, then draw centered
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  ctx.restore()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('rotate canvas.toBlob returned null'))),
      blob.type || 'image/jpeg',
      0.92,
    )
  })
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image blob for rotation'))
    }
    img.src = url
  })
}
