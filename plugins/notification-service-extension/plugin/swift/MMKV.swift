import Foundation
import MMKV

class MMKVHelper {
  static let shared = MMKVHelper()
  
  private let mmkv: MMKV

  private init() {
    let bundleId = Bundle.mainAppBundleId()
    let groupId = Bundle.appGroupIdentifier()
    
    guard let groupUrl = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: groupId
    ) else {
      let error = ErrorFactory.create(domain: "MMKVHelper", description: "Failed to get App Group container URL")
      SentryManager.shared.trackError(error)
      fatalError("Failed to get App Group container URL")
    }
    
    let groupDir = groupUrl.path

    MMKV.initialize(rootDir: nil, groupDir: groupDir, logLevel: MMKVLogLevel.warning)

    // NEVER change the mmapID unless you know what you're doing. This will break the app group because we need to use the same mmapID for the main app and the notification service extension.
    guard let mmkv = MMKV(mmapID: bundleId,
                          cryptKey: nil, 
                          mode: .multiProcess) else {
        // Create and track error if initialization fails
        let errorMessage = "Failed to initialize MMKV with mmapID: \(bundleId)"
        let error = ErrorFactory.create(
            domain: "MMKVHelper",
            description: errorMessage
        )
        SentryManager.shared.trackError(error)
        fatalError(errorMessage)
    }

    self.mmkv = mmkv
    SentryManager.shared.addBreadcrumb("MMKVHelper singleton initialized with mmapID: \(bundleId) and groupDir: \(groupDir)")
  }
  
  func getString(forKey key: String) -> String? {
    guard let value = mmkv.string(forKey: key) else {
      SentryManager.shared.addBreadcrumb("No value found in MMKV for key: \(key)")
      return nil
    }
    
    SentryManager.shared.addBreadcrumb("Found value in MMKV for key: \(key)")
    return value
  }
  
  func setString(_ value: String, forKey key: String) {
    mmkv.set(value, forKey: key)
    SentryManager.shared.addBreadcrumb("Set value in MMKV for key: \(key)")
  }
  
  func removeValue(forKey key: String) {
    mmkv.removeValue(forKey: key)
    SentryManager.shared.addBreadcrumb("Removed value from MMKV for key: \(key)")
  }
}