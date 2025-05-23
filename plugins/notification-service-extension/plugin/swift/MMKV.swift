import Foundation
import MMKV

class MMKVHelper {
  private let mmkv: MMKV
  private var secureMmkvForAccount: [String: MMKV?] = [:]

  private let databaseKeyPrefix = "BACKUP_XMTP_KEY_"

  init?(appGroupDirectoryURL: URL) {
    let bundleId = Bundle.mainAppBundleId()
    let groupDir = appGroupDirectoryURL.path

    MMKV.initialize(rootDir: nil, groupDir: groupDir, logLevel: MMKVLogLevel.warning)

    guard let mmkv = MMKV(mmapID: bundleId,
                          cryptKey: nil,
                          mode: MMKVMode.multiProcess) else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "MMKVHelper", description: "Failed to initialize MMKV with mmapID: \(bundleId)"))
      return nil
    }

    self.mmkv = mmkv
  }

  func getDatabaseKey(for ethereumAddress: String) -> String? {
    return getValueFromMmkv(key: databaseKeyPrefix + ethereumAddress)
  }

  private func getValueFromMmkv(key: String) -> String? {
    guard let value = mmkv.string(forKey: key) else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "MMKVHelper", description: "No value found in group instance for key \(key)"))
      return nil
    }

    return value
  }
}
