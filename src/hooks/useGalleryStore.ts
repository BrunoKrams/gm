import { useEffect, useMemo, useRef, useState } from 'react'

import type { Gallery, ImageRecord } from '../types/gallery'
import { GalleryDb } from '../utils/db'
import {
  extensionFromMimeType,
  fileToDataUrl,
  imageDimensions,
  makeThumbnailDataUrl,
  sanitizeExportName,
  SUPPORTED_IMAGE_TYPES,
} from '../utils/image'
import { deleteImageData, getAllImageData, saveImageData } from '../utils/imageDb'
import { isDirectoryPickerSupported, pickWorkspaceDirectory } from '../utils/fsAccess'

type ImageDataMap = Record<string, { full: string; thumb: string }>

export function useGalleryStore() {
  const browserSupported = isDirectoryPickerSupported()
  const dbRef = useRef<GalleryDb | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null)
  const [images, setImages] = useState<ImageRecord[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [imageData, setImageData] = useState<ImageDataMap>({})

  // Load image blobs from IndexedDB whenever images list changes
  useEffect(() => {
    const ids = images.map((img) => img.id)
    void getAllImageData(ids).then((data) => setImageData(data))
  }, [images])

  const getDb = (): GalleryDb => {
    if (!dbRef.current) throw new Error('No workspace open. Use Open Workspace first.')
    return dbRef.current
  }

  const refreshGalleries = (d: GalleryDb): Gallery[] => {
    const list = d.listGalleries()
    setGalleries(list)
    return list
  }

  const refreshImages = (d: GalleryDb, galleryId: string) => {
    setImages(d.listImages(galleryId))
  }

  const refreshRecent = (d: GalleryDb) => {
    setRecentIds(d.listRecent())
  }

  const openWorkspace = async () => {
    const dirHandle = await pickWorkspaceDirectory()
    const instance = await GalleryDb.open(dirHandle)
    dbRef.current = instance
    setWorkspaceName(dirHandle.name || 'browser-storage')
    const list = refreshGalleries(instance)
    refreshRecent(instance)
    if (list.length > 0) {
      setSelectedGalleryId(list[0].id)
      setImages(instance.listImages(list[0].id))
    } else {
      setSelectedGalleryId(null)
      setImages([])
    }
  }

  const selectedGallery = useMemo<Gallery | null>(
    () => galleries.find((g) => g.id === selectedGalleryId) ?? null,
    [galleries, selectedGalleryId],
  )

  const recentGalleries = useMemo<Gallery[]>(
    () =>
      recentIds
        .map((id) => galleries.find((g) => g.id === id) ?? null)
        .filter((g): g is Gallery => g !== null),
    [galleries, recentIds],
  )

  const createGallery = async (name: string) => {
    const d = getDb()
    const hadAnyGallery = d.listGalleries().length > 0
    const gallery = d.createGallery(name)
    if (!hadAnyGallery) {
      d.setFilenameForGallery(gallery.name)
    }
    d.touchRecent(gallery.id)
    await d.save()
    refreshGalleries(d)
    refreshRecent(d)
    setSelectedGalleryId(gallery.id)
    setImages([])
  }

  const openGallery = async (galleryId: string) => {
    const d = getDb()
    d.touchRecent(galleryId)
    await d.save()
    refreshRecent(d)
    setSelectedGalleryId(galleryId)
    refreshImages(d, galleryId)
  }

  const deleteGallery = async (galleryId: string) => {
    const d = getDb()
    const imgs = d.listImages(galleryId)
    for (const img of imgs) void deleteImageData(img.id)
    d.deleteGallery(galleryId)
    await d.save()
    const remaining = refreshGalleries(d)
    refreshRecent(d)
    if (remaining.length > 0) {
      setSelectedGalleryId(remaining[0].id)
      refreshImages(d, remaining[0].id)
    } else {
      setSelectedGalleryId(null)
      setImages([])
    }
  }

  const importFiles = async (files: FileList | File[]): Promise<number> => {
    const d = getDb()
    if (!selectedGalleryId) throw new Error('Select a gallery first')
    const freshData: ImageDataMap = {}
    let count = 0

    for (const file of Array.from(files)) {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) continue
      const imageFull = await fileToDataUrl(file)
      const imageThumb = await makeThumbnailDataUrl(imageFull)
      const dims = await imageDimensions(imageFull)
      const id = crypto.randomUUID()

      await saveImageData(id, imageFull, imageThumb)
      freshData[id] = { full: imageFull, thumb: imageThumb }

      d.insertImage({
        id,
        galleryId: selectedGalleryId,
        artist: '',
        technique: '',
        title: file.name.replace(/\.[^.]+$/, ''),
        dimensions: dims,
        notes: '',
        originalName: file.name,
        mimeType: file.type,
        importedAt: new Date().toISOString(),
      })
      count++
    }

    if (count === 0) return 0
    await d.save()
    setImageData((prev) => ({ ...prev, ...freshData }))
    refreshImages(d, selectedGalleryId)
    return count
  }

  const updateImage = async (
    imageId: string,
    patch: Pick<ImageRecord, 'artist' | 'technique' | 'title' | 'dimensions' | 'notes'>,
  ) => {
    const d = getDb()
    d.updateImageMetadata(imageId, patch)
    await d.save()
    if (selectedGalleryId) refreshImages(d, selectedGalleryId)
  }

  const deleteImage = async (imageId: string) => {
    const d = getDb()
    void deleteImageData(imageId)
    d.deleteImage(imageId)
    await d.save()
    setImageData((prev) => {
      const next = { ...prev }
      delete next[imageId]
      return next
    })
    if (selectedGalleryId) refreshImages(d, selectedGalleryId)
  }

  const buildExportName = (image: ImageRecord): string => {
    const ext = extensionFromMimeType(image.mimeType)
    return `${sanitizeExportName(image.title || image.originalName.replace(/\.[^.]+$/, ''))}${ext}`
  }

  return {
    browserSupported,
    workspaceName,
    galleries,
    selectedGallery,
    selectedImages: images,
    recentGalleries,
    imageData,
    openWorkspace,
    createGallery,
    openGallery,
    deleteGallery,
    importFiles,
    updateImage,
    deleteImage,
    buildExportName,
  }
}
