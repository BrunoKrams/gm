/**
 * SQLite layer using sql.js (SQLite compiled to WASM).
 *
 * All metadata (galleries, images) lives in a real SQLite database that is
 * written back to the local filesystem via the File System Access API after
 * every mutation.
 */
import initSqlJs, { type Database } from 'sql.js'

import type { Gallery, ImageRecord } from '../types/gallery'
import { readDbFile, writeDbFile } from './fsAccess'

let _SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null

async function getSql() {
  if (!_SQL) {
    _SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
  }
  return _SQL
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS galleries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    gallery_id TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    technique TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    dimensions TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    imported_at TEXT NOT NULL,
    FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_images_gallery ON images(gallery_id);
`

export class GalleryDb {
  private db: Database
  private fileHandle: FileSystemFileHandle
  private displayPath: string

  private constructor(db: Database, fileHandle: FileSystemFileHandle, displayPath: string) {
    this.db = db
    this.fileHandle = fileHandle
    this.displayPath = displayPath
  }

  /** Path string to show in the UI (directory/filename when available, filename otherwise). */
  get path(): string {
    return this.displayPath
  }

  /**
   * Open an existing .gmd file, or initialise an empty database if the file
   * is new/empty.  Pass a FileSystemFileHandle obtained from
   * pickDatabaseFile() or pickDirectoryForNewDatabase().
   */
  static async open(fileHandle: FileSystemFileHandle, displayPath?: string): Promise<GalleryDb> {
    const SQL = await getSql()
    const existing = await readDbFile(fileHandle)
    const db = existing ? new SQL.Database(existing) : new SQL.Database()
    db.run('PRAGMA foreign_keys = ON;')
    db.run(SCHEMA)
    const instance = new GalleryDb(db, fileHandle, displayPath ?? fileHandle.name)
    await instance.save()
    return instance
  }

  async save(): Promise<void> {
    const data = this.db.export()
    await writeDbFile(this.fileHandle, data)
  }

  // ── Galleries ────────────────────────────────────────────────────────────

  listGalleries(): Gallery[] {
    const rows = this.db.exec('SELECT id, name, created_at FROM galleries ORDER BY name')
    if (!rows.length) return []
    return rows[0].values.map(([id, name, created_at]) => ({
      id: id as string,
      name: name as string,
      createdAt: created_at as string,
    }))
  }

  createGallery(name: string): Gallery {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    this.db.run('INSERT INTO galleries (id, name, created_at) VALUES (?, ?, ?)', [
      id,
      name.trim(),
      createdAt,
    ])
    return { id, name: name.trim(), createdAt }
  }

  deleteGallery(galleryId: string): void {
    this.db.run('DELETE FROM galleries WHERE id = ?', [galleryId])
  }

  // ── Images ───────────────────────────────────────────────────────────────

  listImages(galleryId: string): ImageRecord[] {
    const rows = this.db.exec(
      `SELECT id, gallery_id, artist, technique, title, dimensions, notes,
              original_name, mime_type, imported_at
       FROM images WHERE gallery_id = ? ORDER BY imported_at DESC`,
      [galleryId],
    )
    if (!rows.length) return []
    return rows[0].values.map((r) => ({
      id: r[0] as string,
      galleryId: r[1] as string,
      imageFull: '',
      imageThumb: '',
      artist: r[2] as string,
      technique: r[3] as string,
      title: r[4] as string,
      dimensions: r[5] as string,
      notes: r[6] as string,
      originalName: r[7] as string,
      mimeType: r[8] as string,
      importedAt: r[9] as string,
    }))
  }

  insertImage(image: Omit<ImageRecord, 'imageFull' | 'imageThumb'>): void {
    this.db.run(
      `INSERT INTO images
         (id, gallery_id, artist, technique, title, dimensions, notes, original_name, mime_type, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        image.id,
        image.galleryId,
        image.artist,
        image.technique,
        image.title,
        image.dimensions,
        image.notes,
        image.originalName,
        image.mimeType,
        image.importedAt,
      ],
    )
  }

  updateImageMetadata(
    imageId: string,
    patch: Pick<ImageRecord, 'artist' | 'technique' | 'title' | 'dimensions' | 'notes'>,
  ): void {
    this.db.run(
      `UPDATE images SET artist=?, technique=?, title=?, dimensions=?, notes=? WHERE id=?`,
      [patch.artist, patch.technique, patch.title, patch.dimensions, patch.notes, imageId],
    )
  }

  deleteImage(imageId: string): void {
    this.db.run('DELETE FROM images WHERE id = ?', [imageId])
  }
}
