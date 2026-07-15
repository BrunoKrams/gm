const DB_NAME = 'gallery-manager-images-v1'
const STORE_NAME = 'image-data'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveImageData(id: string, full: string, thumb: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ full, thumb }, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getImageData(
  id: string,
): Promise<{ full: string; thumb: string } | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve((req.result as { full: string; thumb: string }) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllImageData(
  ids: string[],
): Promise<Record<string, { full: string; thumb: string }>> {
  if (ids.length === 0) return {}
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const result: Record<string, { full: string; thumb: string }> = {}
    let pending = ids.length
    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = () => {
        if (req.result) result[id] = req.result as { full: string; thumb: string }
        if (--pending === 0) resolve(result)
      }
      req.onerror = () => reject(req.error)
    }
  })
}

export async function deleteImageData(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
