import Foundation
import MMKV
import XMTP

class MMKVHelper {
  private let mmkv: MMKV
  private var secureMmkvForAccount: [String: MMKV?] = [:]

  private let databaseKeyPrefix = "BACKUP_XMTP_KEY_"

  init?(environment: XMTP.XMTPEnvironment,
        appGroupDirectoryURL: URL) {
    let bundleId = Bundle.mainAppBundleId(for: environment)
    let groupDir = appGroupDirectoryURL.path

    MMKV.initialize(rootDir: nil, groupDir: groupDir, logLevel: MMKVLogLevel.warning)

    guard let mmkv = MMKV(mmapID: bundleId,
                          cryptKey: nil,
                          mode: MMKVMode.multiProcess) else {
      return nil
    }

    self.mmkv = mmkv
  }

  func getDatabaseKey(for ethereumAddress: String) -> String? {
    return getValueFromMmkv(key: databaseKeyPrefix + ethereumAddress)
  }

  private func getValueFromMmkv(key: String) -> String? {
    guard let value = mmkv.string(forKey: key) else {
      log.error("No value found in group instance for key \(key)")
      return nil
    }

    return value
  }
}
