import UserNotifications
import os.log

final class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt:   UNMutableNotificationContent?
  private let logger = OSLog(subsystem: "com.convos", category: "NotificationService")

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    os_log("NotificationService didReceive called with request: %{public}@", log: logger, type: .debug, request.identifier)
    
    self.contentHandler = contentHandler
    self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard
      let bestAttempt    = bestAttempt,
      let userInfo       = request.content.userInfo as? [String: Any],
      let encrypted      = userInfo["encryptedMessage"] as? String,
      let topic          = userInfo["contentTopic"]     as? String
    else {
      os_log("NotificationService missing required fields in payload", log: logger, type: .error)
      return contentHandler(request.content)   // show as-is
    }

    os_log("NotificationService processing message - encrypted: %{public}@, topic: %{public}@", log: logger, type: .debug, encrypted, topic)

    /* ──────────  🔐  TODO: real XMTP decrypt  ────────── */
    let plaintext = "[encrypted]"
    bestAttempt.body  = plaintext
    bestAttempt.title = "New Message"

    os_log("NotificationService delivering notification with title: %{public}@, body: %{public}@", log: logger, type: .debug, bestAttempt.title, bestAttempt.body)
    contentHandler(bestAttempt)
  }

  override func serviceExtensionTimeWillExpire() {
    os_log("NotificationService serviceExtensionTimeWillExpire called", log: logger, type: .info)
    if let handler = contentHandler, let content = bestAttempt {
      handler(content)       // show best attempt before iOS kills us
    }
  }

  // Dummy placeholder – returns first 16 chars
  private func decryptXMTP(encrypted: String, topic: String) -> String? {
    os_log("NotificationService attempting to decrypt message", log: logger, type: .debug)
    return "🔓 " + encrypted.prefix(16) + "…"
  }
}
