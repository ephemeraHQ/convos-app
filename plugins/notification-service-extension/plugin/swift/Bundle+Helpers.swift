import Foundation
import XMTP

extension Bundle {
  static func getInfoPlistValue(for key: String) -> String? {
    guard let value = main.infoDictionary?[key] as? String else {
      log.error("Failed to find or cast Info.plist value for key: \(key)")
      return nil
    }

    return value
  }

  static func mainAppBundleId(for environment: XMTP.XMTPEnvironment) -> String {
    guard let bundleId = Bundle.getInfoPlistValue(for: "MainAppBundleIdentifier") else {
      log.debug("Failed getting main app bundle ID from plist, using backup")

      switch environment {
      case .dev:
        return "com.convos.dev"
      case .local:
        return "com.convos.preview"
      case .production:
        return "com.convos.prod"
      }
    }
    return bundleId
  }
}
