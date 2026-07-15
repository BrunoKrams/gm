/**
 * File System Access API helpers.
 *
 * The user either picks an existing .gmd file directly, or chooses a parent
 * folder when creating a new gallery (the file is created there).  Handles
 * are NOT persisted between page reloads — the user must re-open the file
 * each session.
 */

const DB_EXTENSION = '.gmd'

export function toGalleryDbFilename(galleryName: string): string {
  const sanitized = galleryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = sanitized || 'gallery'
  return `gm_${base}${DB_EXTENSION}`
}

export function isFilePickerSupported(): boolean {
  return typeof (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

/** Let the user pick an existing .gmd database file. */
export async function pickDatabaseFile(): Promise<FileSystemFileHandle> {
  const w = window as Window & {
    showOpenFilePicker?: (options?: object) => Promise<FileSystemFileHandle[]>
  }
  if (typeof w.showOpenFilePicker !== 'function') {
    throw new Error('This browser is not supported. Please use Chrome or Edge (File System Access API required).')
  }
  const [handle] = await w.showOpenFilePicker({
    types: [{ description: 'Gallery Database', accept: { 'application/octet-stream': ['.gmd'] } }],
    multiple: false,
    startIn: 'documents',
  })
  return handle
}

/**
 * Let the user choose a parent folder and create a new .gmd file there.
 * Returns the file handle and the parent directory name for display.
 */
export async function pickDirectoryForNewDatabase(
  galleryName: string,
): Promise<{ fileHandle: FileSystemFileHandle; dirName: string }> {
  const w = window as Window & {
    showDirectoryPicker?: (options?: object) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof w.showDirectoryPicker !== 'function') {
    throw new Error('This browser is not supported. Please use Chrome or Edge (File System Access API required).')
  }
  const dirHandle = await w.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' })
  const filename = toGalleryDbFilename(galleryName)
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  return { fileHandle, dirName: dirHandle.name }
}

export async function readDbFile(fileHandle: FileSystemFileHandle): Promise<Uint8Array | null> {
  try {
    const file = await fileHandle.getFile()
    if (file.size === 0) return null
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

export async function writeDbFile(fileHandle: FileSystemFileHandle, data: Uint8Array): Promise<void> {
  const writable = await fileHandle.createWritable()
  await writable.write(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  await writable.close()
}
