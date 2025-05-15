import { MMKV, MMKVConfiguration } from "react-native-mmkv"

export type IMmkvStorage = MMKV

export function createMmkvStorage(options: MMKVConfiguration): IMmkvStorage {
  return new MMKV(options)
}
