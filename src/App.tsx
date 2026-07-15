import { useMemo, useRef, useState } from 'react'
import './App.css'
import { BUTTON_PICTOGRAMS } from './constants/pictograms'
import { useGalleryStore } from './hooks/useGalleryStore'
import type { ImageRecord } from './types/gallery'

function App() {
  const {
    browserSupported,
    workspaceName,
    galleries,
    selectedGallery,
    selectedImages,
    recentGalleries,
    createGallery,
    openGallery,
    deleteGallery,
    importFiles,
    updateImage,
    deleteImage,
    buildExportName,
    imageData,
    openWorkspace,
  } = useGalleryStore()

  const [status, setStatus] = useState('Ready')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null)
  const [editModal, setEditModal] = useState<ImageRecord | null>(null)
  const [editForm, setEditForm] = useState({ artist: '', technique: '', title: '', dimensions: '', notes: '' })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const onOpenWorkspace = async () => {
    try {
      await openWorkspace()
      setStatus('Workspace opened')
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStatus(error.message)
      }
    }
  }

  const onCreateGallery = async () => {
    if (!workspaceName) { setStatus('Open a workspace folder first'); return }
    const name = window.prompt('Gallery name')
    if (!name) return
    try {
      await createGallery(name)
      setStatus(`Created gallery: ${name.trim()}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create gallery')
    }
  }

  const onOpenGallery = () => {
    if (galleries.length === 0) { setStatus('No galleries yet. Create one first.'); return }
    const listing = galleries.map((g, i) => `${i + 1}. ${g.name}`).join('\n')
    const picked = window.prompt(`Switch gallery:\n${listing}\n\nType a number`)
    if (!picked) return
    const index = Number.parseInt(picked, 10) - 1
    if (!Number.isInteger(index) || index < 0 || index >= galleries.length) {
      setStatus('Invalid selection'); return
    }
    const gallery = galleries[index]
    void openGallery(gallery.id)
    setStatus(`Opened gallery: ${gallery.name}`)
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

  const onExportImage = () => {
    if (!selectedImage) {
      setStatus('Select an image first')
      return
    }

    const full = imageData[selectedImage.id]?.full ?? ''
    if (!full) {
      setStatus('Image data not available')
      return
    }
    const link = document.createElement('a')
    link.href = full
    link.download = buildExportName(selectedImage)
    link.click()
    setStatus(`Exported image: ${link.download}`)
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
        <button type="button" onClick={onOpenWorkspace} disabled={!browserSupported}>
          {renderToolbarButtonContent('openWorkspace')}
        </button>
        <button type="button" onClick={onCreateGallery} disabled={!workspaceName}>
          {renderToolbarButtonContent('newGallery')}
        </button>
        <button type="button" onClick={onOpenGallery} disabled={!workspaceName || galleries.length === 0}>
          {renderToolbarButtonContent('openGallery')}
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
        <button type="button" onClick={onExportImage} disabled={!selectedImage}>
          {renderToolbarButtonContent('exportImage')}
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
            {selectedGallery
              ? `Gallery: ${selectedGallery.name}`
              : workspaceName
                ? `Workspace: ${workspaceName}`
                : 'No workspace open'}
          </h1>
          <p>
            {selectedGallery
              ? 'Select an image and click Edit to update its metadata. Double-click a thumbnail to preview.'
              : workspaceName
                ? 'Create or switch to a gallery.'
                : 'Click Open Workspace to pick a folder — files are saved as gm_<GALLERY_NAME>.gmd.'}
          </p>
          {recentGalleries.length > 0 && (
            <p className="recent">
              Recent:{' '}
              {recentGalleries.map((gallery) => (
                <button
                  key={gallery.id}
                  type="button"
                  className="link-button"
                  onClick={() => {
                    void openGallery(gallery.id)
                    setStatus(`Switched to: ${gallery.name}`)
                  }}
                >
                  {gallery.name}
                </button>
              ))}
            </p>
          )}
        </section>

        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Artist</th>
                <th>Technique</th>
                <th>Title</th>
                <th>Dimensions</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {selectedImages.map((image) => {
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
            <img src={imageData[previewImage.id]?.full ?? ''} alt={previewImage.title || previewImage.originalName} />
            <p>{previewImage.title || previewImage.originalName}</p>
            <button type="button" onClick={() => setPreviewImage(null)}>
              Close
            </button>
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
    </div>
  )
}

export default App
