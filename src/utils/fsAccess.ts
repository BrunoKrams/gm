/**
 * File System Access API helpers.
 *
 * The user picks a workspace directory once; we hold a reference to the
 * FileSystemDirectoryHandle for the session and write the .db file there on
 * every change.  The handle is NOT persisted between page reloads (the API
 * requires a user gesture to re-grant access), so the user must re-open the
 * folder each time they open the app.
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

export async function findExistingGalleryDbFilename(
  dirHandle: FileSystemDirectoryHandle,
): Promise<string | null> {
  const candidates: Array<{ name: string; lastModified: number }> = []

  for await (const [entryName, entryHandle] of dirHandle.entries()) {
    if (entryHandle.kind !== 'file') continue
    if (!entryName.startsWith('gm_') || !entryName.endsWith(DB_EXTENSION)) continue

    try {
      const file = await (entryHandle as FileSystemFileHandle).getFile()
      candidates.push({ name: entryName, lastModified: file.lastModified })
    } catch {
      // ignore unreadable candidate
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.lastModified - a.lastModified)
  return candidates[0].name
}

export function isDirectoryPickerSupported(): boolean {
  const windowWithPicker = window as Window & {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle>
  }
  return typeof windowWithPicker.showDirectoryPicker === 'function'
}

export async function pickWorkspaceDirectory(): Promise<FileSystemDirectoryHandle> {
  const windowWithPicker = window as Window & {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle>
  }

  if (typeof windowWithPicker.showDirectoryPicker === 'function') {
    const handle = await windowWithPicker.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    })
    return handle
  }
  throw new Error(
    'This browser is not supported. Please use Chrome or Edge (File System Access API required).',
  )
}

export async function readDbFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<Uint8Array | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: false })
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    // File doesn't exist yet
    return null
  }
}

export async function writeDbFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  data: Uint8Array,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  await writable.close()
}
