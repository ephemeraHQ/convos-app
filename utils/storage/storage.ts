import { MMKV } from "react-native-mmkv"

export const storage = new MMKV()

export type IStorage = MMKV

export function createStorage(id: string): IStorage {
  return new MMKV({ id })
}

/**
 * Get the size of an MMKV storage instance in bytes
 */
export function getStorageSize(storage: MMKV): number {
  // @ts-ignore - size is available but not in type definitions
  return storage.size || 0
}

/**
 * Trim an MMKV storage instance to free memory and clean unused space
 */
export function trimStorage(storage: MMKV): void {
  // @ts-ignore - trim is available but not in type definitions
  if (typeof storage.trim === "function") {
    storage.trim()
  }
}
