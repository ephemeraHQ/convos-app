import Foundation
import Sentry
import XMTP

final class SentryManager {
  static let shared = SentryManager()

  private init() {
      let sentryEnv = XMTP.Client.xmtpEnvironment.rawValue
      SentrySDK.start { options in
        options.dsn = "https://o4504757119680512.ingest.us.sentry.io/4509079521067008"
        options.environment = sentryEnv
        options.debug = false
      }
  }

  func startSentry() {}

  func trackMessage(_ message: String, extras: [String: Any]? = nil) {
    SentrySDK.capture(message: message) { scope in
      var extrasWithMessage: [String: Any] = ["where": "NOTIFICATION_EXTENSION_IOS"]
      extras?.forEach { extrasWithMessage[$0] = $1 }
      scope.setExtras(extrasWithMessage)
      print(message)
      print(extrasWithMessage)
    }
    SentrySDK.flush(timeout: 3)
  }

  func trackError(_ error: Error, extras: [String: Any]? = nil) {
    print([error, extras ?? [:]])
    SentrySDK.capture(error: error) { scope in
      var extrasWithMessage: [String: Any] = [:]
      extras?.forEach { extrasWithMessage[$0] = $1 }
      scope.setExtras(extrasWithMessage)
      print(error)
      print(extrasWithMessage)
    }
    SentrySDK.flush(timeout: 3)
  }

  func addBreadcrumb(_ message: String) {
    print(message)
    let crumb = Breadcrumb()
    crumb.level = .info
    crumb.category = "extension"
    crumb.message = message
    SentrySDK.addBreadcrumb(crumb)
  }
}
