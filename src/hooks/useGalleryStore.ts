import { useMemo, useRef, useState } from 'react'

import type { Gallery, ImageRecord } from '../types/gallery'
import { GalleryDb } from '../utils/db'
import {
  fileToDataUrl,
  imageDimensions,
  makeThumbnailDataUrl,
  SUPPORTED_IMAGE_TYPES,
} from '../utils/image'
import { isFilePickerSupported, pickDatabaseFile, pickDirectoryForNewDatabase } from '../utils/fsAccess'

type ImageDataMap = Record<string, { full: string; thumb: string }>

export function useGalleryStore() {
  const browserSupported = isFilePickerSupported()
  const dbRef = useRef<GalleryDb | null>(null)
  const [dbName, setDbName] = useState<string | null>(null)
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null)
  const [images, setImages] = useState<ImageRecord[]>([])
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)

  const imageData = useMemo<ImageDataMap>(
    () =>
      Object.fromEntries(
        images.map((image) => [image.id, { full: image.imageFull, thumb: image.imageThumb }]),
      ),
    [images],
  )

  const getDb = (): GalleryDb => {
    if (!dbRef.current) throw new Error('No database open. Open a gallery file first.')
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

  const openDatabase = async () => {
    const fileHandle = await pickDatabaseFile()
    const instance = await GalleryDb.open(fileHandle)
    dbRef.current = instance
    setDbName(instance.path)
    const list = refreshGalleries(instance)
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

  const createGallery = async (name: string) => {
    const { fileHandle, dirName } = await pickDirectoryForNewDatabase(name)
    const instance = await GalleryDb.open(fileHandle, `${dirName}/${fileHandle.name}`)
    dbRef.current = instance
    const gallery = instance.createGallery(name)
    await instance.save()
    setDbName(instance.path)
    refreshGalleries(instance)
    setSelectedGalleryId(gallery.id)
    setImages([])
  }

  const deleteGallery = async (galleryId: string) => {
    const d = getDb()
    d.deleteGallery(galleryId)
    await d.save()
    const remaining = refreshGalleries(d)
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

    const supportedFiles = Array.from(files).filter((f) => SUPPORTED_IMAGE_TYPES.has(f.type))
    if (supportedFiles.length === 0) return 0

    setImportProgress({ current: 0, total: supportedFiles.length })
    let count = 0

    for (const file of supportedFiles) {
      const imageFull = await fileToDataUrl(file)
      const imageThumb = await makeThumbnailDataUrl(imageFull)
      const dims = await imageDimensions(imageFull)
      const id = crypto.randomUUID()

      d.insertImage({
        id,
        galleryId: selectedGalleryId,
        imageFull,
        imageThumb,
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
      setImportProgress({ current: count, total: supportedFiles.length })
    }

    await d.save()
    refreshImages(d, selectedGalleryId)
    setImportProgress(null)
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
    d.deleteImage(imageId)
    await d.save()
    if (selectedGalleryId) refreshImages(d, selectedGalleryId)
  }

  return {
    browserSupported,
    dbName,
    galleries,
    selectedGallery,
    selectedImages: images,
    imageData,
    importProgress,
    openDatabase,
    createGallery,
    deleteGallery,
    importFiles,
    updateImage,
    deleteImage,
  }
}
