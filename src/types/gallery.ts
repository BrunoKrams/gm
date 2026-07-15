export interface ImageRecord {
  id: string
  galleryId: string
  imageFull: string
  imageThumb: string
  artist: string
  technique: string
  title: string
  dimensions: string
  notes: string
  importedAt: string
  originalName: string
  mimeType: string
}

export interface Gallery {
  id: string
  name: string
  createdAt: string
}

export interface GalleryStoreState {
  galleries: Gallery[]
  imagesByGallery: Record<string, ImageRecord[]>
  selectedGalleryId: string | null
  recentGalleryIds: string[]
}
