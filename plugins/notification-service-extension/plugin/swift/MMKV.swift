import Foundation
import MMKV

private var mmkvInstanceWithGroup: MMKV? = nil
private var mmkvInstanceNoGroup: MMKV? = nil
private var secureMmkvForAccount: [String: MMKV?] = [:]
private var mmkvInitialized = false

func initializeMmkv() {
    if (!mmkvInitialized) {
        mmkvInitialized = true
        let bundleId = getInfoPlistValue(key: "MainAppBundleIdentifier")
        let groupId = "group.\(bundleId)"
        let groupDir = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: groupId)?.path
        guard let groupDir else {
            log.error("Failed to get bundleId + group: \(#function)")
            return
        }

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
        log.debug("Found value in group instance for key \(key): \(value)")
        return value
    } else {
        log.error("No value found in group instance for key \(key)")
    }

    // Try getting from non-group instance
    if let value = mmkvNoGroup?.string(forKey: key) {
        log.debug("Found value in non-group instance for key \(key): \(value)")
        return value
    } else {
        log.error("No value found in non-group instance for key \(key)")
    }

    log.error("No value found in either MMKV instance for key \(key)")
    return nil
}
