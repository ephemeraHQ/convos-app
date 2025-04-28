import { MMKV } from "react-native-mmkv"

export const storage = new MMKV()

export type IStorage = MMKV

export function createStorage(id: string): IStorage {
  return new MMKV({ id })
}
