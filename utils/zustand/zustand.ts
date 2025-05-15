import { createJSONStorage, PersistStorage, StateStorage } from "zustand/middleware"
import { createStorage } from "@/utils/storage/storage"

/**
 * Zustand storage adapter for MMKV
 */
export function getZustandStorage<T>(args: { id: string }): PersistStorage<T> {
  const { id } = args

  const storage = createStorage({ id })

  return createJSONStorage(
    (): StateStorage => ({
      setItem(name, value) {
        // Deleting before setting to avoid memory leak
        // https://github.com/mrousavy/react-native-mmkv/issues/440
        storage.delete(name)
        return storage.set(name, JSON.stringify(value))
      },
      getItem(name) {
        const value = storage.getString(name)
        return value ?? null
      },
      removeItem(name) {
        return storage.delete(name)
      },
    }),
  )!
}
