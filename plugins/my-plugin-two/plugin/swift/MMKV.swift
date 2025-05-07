import Foundation
import MMKV

private var mmkvInstance: MMKV? = nil;
private var secureMmkvForAccount: [String: MMKV?] = [:];
private var mmkvInitialized = false;

func initializeMmkv() {
  if (!mmkvInitialized) {
    mmkvInitialized = true
    let groupId = "group.\(try! getInfoPlistValue(key: "MainAppBundleIdentifier"))"
    let groupDir = (FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId)?.path)!
    MMKV.initialize(rootDir: nil, groupDir: groupDir, logLevel: MMKVLogLevel.warning)
  }
}

func getMmkv() -> MMKV? {
  if (mmkvInstance == nil) {
    initializeMmkv()
    mmkvInstance = MMKV(mmapID: "mmkv.default", cryptKey: nil, mode: MMKVMode.multiProcess)
  }
  
  return mmkvInstance;
}

func getBackupKeyInMmkv(ethAddress: String) -> String {
  let mmkv = getMmkv()
  if let backupKey = mmkv?.string(forKey: "BACKUP_XMTP_KEY_\(ethAddress.lowercased())") {
    return String(backupKey)
  }
  return ""
}