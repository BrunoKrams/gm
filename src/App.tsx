import { useMemo, useRef, useState } from 'react'
import './App.css'
import { BUTTON_PICTOGRAMS } from './constants/pictograms'
import { useGalleryStore } from './hooks/useGalleryStore'
import type { ImageRecord } from './types/gallery'

function App() {
  const {
    browserSupported,
    dbName,
    selectedGallery,
    selectedImages,
    createGallery,
    deleteGallery,
    importFiles,
    updateImage,
    deleteImage,
    imageData,
    importProgress,
    openDatabase,
  } = useGalleryStore()

  const [status, setStatus] = useState('Ready')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null)
  const [editModal, setEditModal] = useState<ImageRecord | null>(null)
  const [editForm, setEditForm] = useState({ artist: '', technique: '', title: '', dimensions: '', notes: '' })
  const [newGalleryModal, setNewGalleryModal] = useState(false)
  const [newGalleryName, setNewGalleryName] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  type SortCol = 'artist' | 'technique' | 'title' | 'dimensions' | 'notes'
  const sortableCols: Array<{ key: SortCol; label: string }> = [
    { key: 'artist', label: 'Artist' },
    { key: 'technique', label: 'Technique' },
    { key: 'title', label: 'Title' },
    { key: 'dimensions', label: 'Dimensions' },
    { key: 'notes', label: 'Notes' },
  ]
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const displayedImages = useMemo(() => {
    if (!sortCol) return selectedImages
    return [...selectedImages].sort((a, b) => {
      const cmp = a[sortCol].localeCompare(b[sortCol])
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [selectedImages, sortCol, sortDir])

  const selectedImage = useMemo(
    () => selectedImages.find((image) => image.id === selectedImageId) ?? null,
    [selectedImageId, selectedImages],
  )

  const openEditModal = () => {
    if (!selectedImage) return
    setEditForm({
      artist: selectedImage.artist,
      technique: selectedImage.technique,
      title: selectedImage.title,
      dimensions: selectedImage.dimensions,
      notes: selectedImage.notes,
    })
    setEditModal(selectedImage)
  }

  const commitEdit = () => {
    if (!editModal) return
    void updateImage(editModal.id, editForm)
    setEditModal(null)
    setStatus('Image metadata updated')
  }

  const onOpenDatabase = async () => {
    try {
      await openDatabase()
      setStatus('Gallery opened')
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStatus(error.message)
      }
    }
  }

  const onCreateGallery = () => {
    setNewGalleryName('')
    setNewGalleryModal(true)
  }

  const onNewGalleryCreate = async () => {
    const name = newGalleryName.trim()
    if (!name) return
    setNewGalleryModal(false)
    try {
      await createGallery(name)
      setStatus(`Created gallery: ${name}`)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStatus(error instanceof Error ? error.message : 'Failed to create gallery')
      }
    }
  }

  const onDeleteGallery = async () => {
    if (!selectedGallery) {
      setStatus('Open a gallery first')
      return
    }
    const confirmed = window.confirm(`Delete ${selectedGallery.name} and all imported images?`)
    if (!confirmed) return
    await deleteGallery(selectedGallery.id)
    setSelectedImageId(null)
    setStatus('Gallery deleted')
  }

  const onAddImages = () => {
    if (!selectedGallery) {
      setStatus('Select a gallery first')
      return
    }
    fileInputRef.current?.click()
  }

  const onFileInput: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    try {
      const importedCount = await importFiles(files)
      setStatus(`Imported ${importedCount} images`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to import images')
    } finally {
      event.currentTarget.value = ''
    }
  }

  const onDeleteImage = async () => {
    if (!selectedImage) {
      setStatus('Select an image first')
      return
    }
    if (!window.confirm('Delete selected image?')) return
    await deleteImage(selectedImage.id)
    setSelectedImageId(null)
    setStatus('Image deleted')
  }

  const renderToolbarButtonContent = (key: keyof typeof BUTTON_PICTOGRAMS) => {
    const item = BUTTON_PICTOGRAMS[key]
    return (
      <span className="toolbar-button-content">
        <span className="material-symbols-rounded toolbar-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </span>
    )
  }

  return (
    <div className="app-shell">
      {!browserSupported && (
        <div className="unsupported-banner" role="alert">
          This browser is not supported. Please use Chrome or Edge.
        </div>
      )}
      <header className="toolbar">
        <button type="button" onClick={onOpenDatabase} disabled={!browserSupported}>
          {renderToolbarButtonContent('openWorkspace')}
        </button>
        <button type="button" onClick={onCreateGallery} disabled={!browserSupported}>
          {renderToolbarButtonContent('newGallery')}
        </button>
        <button type="button" onClick={onDeleteGallery} disabled={!selectedGallery}>
          {renderToolbarButtonContent('deleteGallery')}
        </button>
        <span className="separator" />
        <button type="button" onClick={onAddImages} disabled={!selectedGallery}>
          {renderToolbarButtonContent('addImage')}
        </button>
        <button type="button" onClick={onDeleteImage} disabled={!selectedImage}>
          {renderToolbarButtonContent('deleteImage')}
        </button>
        <button type="button" onClick={openEditModal} disabled={!selectedImage}>
          {renderToolbarButtonContent('editImage')}
        </button>
        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInput}
        />
      </header>

      <main className="content">
        <section className="gallery-header">
          <h1>
            {dbName ?? 'No gallery open'}
          </h1>
        </section>

        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                {sortableCols.map((col) => (
                  <th key={col.key} className="sortable-th" onClick={() => toggleSort(col.key)}>
                    <div className="th-label">
                      <span>{col.label}</span>
                      {sortCol === col.key && (
                        <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedImages.map((image) => {
                const fields: Array<'artist' | 'technique' | 'title' | 'dimensions' | 'notes'> = [
                  'artist',
                  'technique',
                  'title',
                  'dimensions',
                  'notes',
                ]

                return (
                  <tr
                    key={image.id}
                    className={selectedImageId === image.id ? 'selected' : ''}
                    onClick={() => setSelectedImageId(image.id)}
                    onDoubleClick={() => {
                      setSelectedImageId(image.id)
                      setPreviewImage(image)
                    }}
                  >
                    <td>
                      <img
                        src={imageData[image.id]?.thumb ?? ''}
                        alt={image.title || image.originalName}
                      />
                    </td>
                    {fields.map((field) => (
                      <td key={`${image.id}-${field}`}>{image[field]}</td>
                    ))}
                  </tr>
                )
              })}
              {selectedGallery && selectedImages.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No images yet. Use Add to import files.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>

      <footer className="footer">
        <span>{status}</span>
        <span>Images: {selectedImages.length}</span>
      </footer>

      {previewImage && (
        <div className="preview-backdrop" onClick={() => setPreviewImage(null)}>
          <div className="preview-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="card-close" aria-label="Close" onClick={() => setPreviewImage(null)}>
              <span className="material-symbols-rounded">close</span>
            </button>
            <img src={imageData[previewImage.id]?.full ?? ''} alt={previewImage.title || previewImage.originalName} />
            <p>{previewImage.title || previewImage.originalName}</p>
          </div>
        </div>
      )}

      {newGalleryModal && (
        <div className="preview-backdrop" onClick={() => setNewGalleryModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Gallery</h2>
            <label>
              Gallery name
              <input
                autoFocus
                value={newGalleryName}
                onChange={(e) => setNewGalleryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void onNewGalleryCreate() }}
              />
            </label>
            <div className="edit-modal-actions">
              <button type="button" onClick={() => setNewGalleryModal(false)}>Cancel</button>
              <button type="button" className="primary" disabled={!newGalleryName.trim()} onClick={() => void onNewGalleryCreate()}>
                Choose Folder & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="preview-backdrop" onClick={() => setEditModal(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Metadata</h2>
            <label>
              Title
              <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
            <label>
              Artist
              <input value={editForm.artist} onChange={(e) => setEditForm((f) => ({ ...f, artist: e.target.value }))} />
            </label>
            <label>
              Technique
              <input value={editForm.technique} onChange={(e) => setEditForm((f) => ({ ...f, technique: e.target.value }))} />
            </label>
            <label>
              Dimensions
              <input value={editForm.dimensions} onChange={(e) => setEditForm((f) => ({ ...f, dimensions: e.target.value }))} />
            </label>
            <label>
              Notes
              <textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div className="edit-modal-actions">
              <button type="button" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="button" className="primary" onClick={commitEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
      {importProgress && (
        <div className="import-overlay">
          <div className="import-card">
            <p className="import-label">Importing images…</p>
            <p className="import-count">{importProgress.current} / {importProgress.total}</p>
            <div className="import-bar-track">
              <div
                className="import-bar-fill"
                style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
