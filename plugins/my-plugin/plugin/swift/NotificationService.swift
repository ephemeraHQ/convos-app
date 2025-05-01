import UserNotifications

final class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt:   UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard
      let bestAttempt    = bestAttempt,
      let userInfo       = request.content.userInfo as? [String: Any],
      let encrypted      = userInfo["encryptedMessage"] as? String,
      let topic          = userInfo["contentTopic"]     as? String
    else {
      return contentHandler(request.content)   // show as-is
    }

    /* ──────────  🔐  TODO: real XMTP decrypt  ────────── */
    let plaintext = decryptXMTP(encrypted: encrypted, topic: topic) ?? "[encrypted]"
    bestAttempt.body  = plaintext
    bestAttempt.title = "New Message"

    contentHandler(bestAttempt)
  }

  override func serviceExtensionTimeWillExpire() {
    if let handler = contentHandler, let content = bestAttempt {
      handler(content)       // show best attempt before iOS kills us
    }
  }

  // Dummy placeholder – returns first 16 chars
  private func decryptXMTP(encrypted: String, topic: String) -> String? {
    return "🔓 " + encrypted.prefix(16) + "…"
  }
}