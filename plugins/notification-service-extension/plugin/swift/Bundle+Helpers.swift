import Foundation
import XMTP

extension Bundle {
  enum Environment: String {
    case development
    case preview 
    case production
  }

  static func getInfoPlistValue(for key: String) -> String? {
    guard let value = main.infoDictionary?[key] as? String else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "BundleHelpers", description: "Failed to find or cast Info.plist value for key: \(key)"))
      return nil
    }

    return value
  }

  static func getEnv() -> Environment {
    guard let env = Bundle.getInfoPlistValue(for: "Environment") else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "BundleHelpers", description: "Failed to get 'Environment' from plist, defaulting to dev"))
      return .development
    }
    
    switch env.lowercased() {
    case "preview":
      return .preview
    case "production":
      return .production
    default:
      return .development
    }
  }

  static func mainAppBundleId() -> String {
    guard let bundleId = Bundle.getInfoPlistValue(for: "MainAppBundleIdentifier") else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "BundleHelpers", description: "Failed getting 'MainAppBundleIdentifier' from plist, using backup for env: \(getEnv())"))

      let environment = Bundle.getEnv()

      switch environment {
      case .development:
        return "com.convos.dev"
      case .preview:
        return "com.convos.preview" 
      case .production:
        return "com.convos.prod"
      }
    }
    return bundleId
  }

  static func appGroupIdentifier() -> String {
    if let appGroupIdentifierFromPlist = Bundle.getInfoPlistValue(
      for: "AppGroupIdentifier"
    ) {
      return appGroupIdentifierFromPlist
    } else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "BundleHelpers", description: "Failed getting app group ID from plist, using backup"))

      let environment = Bundle.getEnv()

      switch environment {
      case .development:
        return "group.com.convos.dev"
      case .preview:
        return "group.com.convos.preview"
      case .production:
        return "group.com.convos.prod"
      }
    }
  }
}
