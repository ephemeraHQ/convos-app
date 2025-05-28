import Foundation
import Sentry
import XMTP

final class SentryManager {
  static let shared = SentryManager()
  private init() {
      let sentryEnv = Bundle.getEnv()
      log.debug("[Sentry] Initializing Sentry with environment: \(sentryEnv.rawValue)")
      SentrySDK.start { options in
        options.dsn = "https://dc072f632e53ca5d87b47120ad0a2e31@o4504757119680512.ingest.us.sentry.io/4509079521067008"
        options.environment = sentryEnv.rawValue
        options.debug = false
      }
  }

  func startSentry() {}

  func trackMessage(_ message: String, extras: [String: Any]? = nil) {
    SentrySDK.capture(message: message) { scope in
      var extrasWithMessage: [String: Any] = ["where": "NOTIFICATION_EXTENSION_IOS"]
      extras?.forEach { extrasWithMessage[$0] = $1 }
      scope.setExtras(extrasWithMessage)
      log.debug("[Sentry] Tracking message: \(message), Message extras: \(extrasWithMessage)")
    }
    SentrySDK.flush(timeout: 3)
  }

  func trackError(_ error: Error, extras: [String: Any]? = nil) {
    log.debug("[Sentry] Tracking error with context:", [error, extras ?? [:]])
    SentrySDK.capture(error: error) { scope in
      var extrasWithMessage: [String: Any] = [:]
      extras?.forEach { extrasWithMessage[$0] = $1 }
      scope.setExtras(extrasWithMessage)
      log.debug("[Sentry] Error details and extras:", [error, extrasWithMessage])
    }
    SentrySDK.flush(timeout: 3)
  }

  func addBreadcrumb(_ message: String, extras: [String: Any]? = nil) {
    if let extras = extras {
      log.debug("[Sentry] Adding breadcrumb: \(message), extras: \(extras)")
    } else {
      log.debug("[Sentry] Adding breadcrumb: \(message)")
    }
    let crumb = Breadcrumb()
    crumb.level = .info
    crumb.category = "ios-notification-service-extension"
    crumb.message = message
    crumb.data = extras
    SentrySDK.addBreadcrumb(crumb)
  }
}
