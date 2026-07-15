export const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
])

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error(`Failed to read file: ${file.name}`))
    }
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Invalid image data'))
    image.src = src
  })
}

export async function imageDimensions(src: string): Promise<string> {
  const image = await loadImage(src)
  return `${image.width}x${image.height}`
}

export async function makeThumbnailDataUrl(
  src: string,
  maxWidth = 180,
  maxHeight = 180,
): Promise<string> {
  const image = await loadImage(src)
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas unavailable')
  }
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

export function sanitizeExportName(name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+|[._]+$/g, '')
  return sanitized || 'image'
}

export function extensionFromMimeType(mimeType: string): string {
  const mapping: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/webp': '.webp',
    'image/tiff': '.tiff',
  }
  return mapping[mimeType] ?? '.png'
}
