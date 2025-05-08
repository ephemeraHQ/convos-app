import Foundation
import MMKV

private var mmkvInstanceWithGroup: MMKV? = nil
private var mmkvInstanceNoGroup: MMKV? = nil
private var secureMmkvForAccount: [String: MMKV?] = [:]
private var mmkvInitialized = false

func initializeMmkv() {
  if (!mmkvInitialized) {
    mmkvInitialized = true
    let groupId = "group.\(try! getInfoPlistValue(key: "MainAppBundleIdentifier"))"
    let groupDir =
      (FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId)?.path)!

    // Initialize MMKV with group directory
    MMKV.initialize(rootDir: nil, groupDir: groupDir, logLevel: MMKVLogLevel.warning)

    // Initialize MMKV without group directory
    MMKV.initialize(rootDir: nil, logLevel: MMKVLogLevel.warning)
  }
}

func getMmkv(id: String? = nil) -> (MMKV?, MMKV?) {
  if (mmkvInstanceWithGroup == nil || mmkvInstanceNoGroup == nil) {
    initializeMmkv()
    let mmapId = id ?? "mmkv.default"

    mmkvInstanceWithGroup = MMKV(mmapID: mmapId, cryptKey: nil, mode: MMKVMode.multiProcess)
    mmkvInstanceNoGroup = MMKV(mmapID: mmapId, cryptKey: nil)
  }

  return (mmkvInstanceWithGroup, mmkvInstanceNoGroup)
}

func getValueFromMmkv(key: String, id: String? = nil) -> String? {
  let (mmkvWithGroup, mmkvNoGroup) = getMmkv(id: id)

  // Try getting from group instance first
  if let value = mmkvWithGroup?.string(forKey: key) {
    log("Found value in group instance for key \(key): \(value)", type: .debug, category: "mmkv")
    return value
  } else {
    log("No value found in group instance for key \(key)", type: .debug, category: "mmkv")
  }

  // Try getting from non-group instance
  if let value = mmkvNoGroup?.string(forKey: key) {
    log(
      "Found value in non-group instance for key \(key): \(value)", type: .debug, category: "mmkv")
    return value
  } else {
    log("No value found in non-group instance for key \(key)", type: .debug, category: "mmkv")
  }

  log("No value found for key: \(key)", type: .debug, category: "mmkv")
  return nil
}