import { MMKV, MMKVConfiguration } from "react-native-mmkv"

export const storage = new MMKV()

export type IStorage = MMKV

export function createStorage(options: MMKVConfiguration): IStorage {
  return new MMKV(options)
}
