import { createJSONStorage, PersistStorage, StateStorage } from "zustand/middleware"
import { createMmkvStorage } from "@/utils/storage/mmkv"
import { sharedDefaults } from "@/utils/storage/shared-defaults"

export function getZustandStorageFromSharedDefaults<T>(): PersistStorage<T> {
  return createJSONStorage(
    (): StateStorage => ({
      setItem(name, value) {
        sharedDefaults.setValue(name, value)
      },
      getItem(name) {
        const value = sharedDefaults.getValue(name)
        return value ?? null
      },
      removeItem(name) {
        return sharedDefaults.deleteValue(name)
      },
    }),
  )!
}

export function getZustandMmkvStorage<T>(args: { id: string }): PersistStorage<T> {
  const { id } = args

  const storage = createMmkvStorage({ id })

  return createJSONStorage(
    (): StateStorage => ({
      setItem(name, value) {
        // Deleting before setting to avoid memory leak
        // https://github.com/mrousavy/react-native-mmkv/issues/440
        storage.delete(name)
        storage.set(name, JSON.stringify(value))
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
