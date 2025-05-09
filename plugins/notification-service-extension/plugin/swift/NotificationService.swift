import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt:   UNMutableNotificationContent?
  private let logger = OSLog(subsystem: "com.convos.nse", category: "NotificationService")

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    os_log("didReceive called for request ID: %{public}@", log: logger, type: .info, request.identifier) // Changed to .info
    os_log("Full UNNotificationRequest content:\n%{public}@", log: logger, type: .info, request.content.description) // Changed to .info
    
    self.contentHandler = contentHandler
    self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

    Task {
      await handleNotificationAsync(request: request)
    }
  }

  // Main asynchronous processing logic
  private func handleNotificationAsync(request: UNNotificationRequest) async {
    guard let currentBestAttempt = bestAttempt else {
      os_log("Failed to get mutable copy", log: logger, type: .error); contentHandler?(request.content); return
    }

    // Ensure userInfo is not nil and can be cast to [String: Any]
    guard let userInfo = request.content.userInfo as? [String: Any]
    else {
      os_log("Could not extract userInfo as [String: Any] from notification content or userInfo is nil.", log: logger, type: .error); contentHandler?(request.content); return
    }

    // Log the received userInfo for debugging
    os_log("Received notification userInfo: %{public}@", log: logger, type: .info, String(describing: userInfo))

    // Define Decodable structs for parsing the notification payload.
    // These are typically defined at the class or file level if they represent common data models.
    struct NotificationBody: Decodable {
        let encryptedMessage: String
        let contentTopic: String
        let ethAddress: String
    }

    struct NotificationPayload: Decodable {
        let body: NotificationBody
    }

    let encryptedMessage: String
    let topic: String
    let ethAddress: String

    do {
        // Convert the userInfo dictionary to Data
        let jsonDataForDecoding = try JSONSerialization.data(withJSONObject: userInfo, options: [])
        
        // Decode the JSON data into our structs
        let decoder = JSONDecoder()
        let payload = try decoder.decode(NotificationPayload.self, from: jsonDataForDecoding)

        encryptedMessage = payload.body.encryptedMessage
        topic = payload.body.contentTopic
        ethAddress = payload.body.ethAddress.lowercased()
        
    } catch {
        // Log detailed error information if decoding fails
        os_log("Failed to decode notification payload or extract required fields: %{public}@", log: logger, type: .error, String(describing: error))
        contentHandler?(request.content); return
    }

    // Make sure we have a valid ethAddress
    guard !ethAddress.isEmpty else {
        os_log("ethAddress is empty after decoding, cannot proceed.", log: logger, type: .error)
        contentHandler?(request.content); return
    }

    

    do {
      // Note: Building the client might be resource-intensive for an NSE. Monitor performance.
      let client = try await getXmtpClient(ethAddress: ethAddress)

      // --- 4. Decrypt Message ---
      os_log("Attempting to find conversation by topic: %{public}@", log: logger, type: .info, topic) // Changed to .info

      guard let conversation = try? await client?.conversations.findConversationByTopic(topic: topic) else {
        os_log("Conversation not found for topic: %{public}@", log: logger, type: .default, topic)
        contentHandler?(currentBestAttempt); return
      }
      
      os_log("Conversation found. Syncing...", log: logger, type: .info) // Changed to .info
      try? await conversation.sync()

      guard let messageBytes = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
      os_log("Failed to decode base64 encryptedMessage payload", log: logger, type: .error)
      contentHandler?(request.content); return
    }

      os_log("Processing message bytes...", log: logger, type: .info) // Changed to .info
      guard let decodedMessage = try? await conversation.processMessage(messageBytes: messageBytes) else {
        os_log("Failed to process message bytes for topic: %{public}@", log: logger, type: .error, topic)
        contentHandler?(currentBestAttempt); return
      }

      // --- 5. Update Notification Content ---
      var plaintext = "[Encrypted Content]" // Default

      do {
        let currentEncodedContent = try decodedMessage.encodedContent
        if currentEncodedContent.type == ContentTypeText {
          if let textContent = try? decodedMessage.content() as String {
             plaintext = textContent
             os_log("Successfully decrypted text message", log: logger, type: .info) // Changed to .info
          } else {
            os_log("Content type was text, but failed to decode as String or content() threw an error.", log: logger, type: .default)
            if let fallbackText = try? decodedMessage.fallback {
                plaintext = fallbackText
                os_log("Used fallback content for text message.", log: logger, type: .info) // Changed to .info
            } else {
                os_log("Failed to get fallback content as well.", log: logger, type: .default)
                plaintext = "[Decryption/Format Error]"
            }
          }
        } else {
          let contentType = "\(currentEncodedContent.type.authorityID)/\(currentEncodedContent.type.typeID):\(currentEncodedContent.type.versionMajor).\(currentEncodedContent.type.versionMinor)"
          os_log("Received non-text message type: %{public}@", log: logger, type: .info) // Kept as .info
           if let fallbackText = try? decodedMessage.fallback {
               plaintext = fallbackText
               os_log("Used fallback content for non-text message.", log: logger, type: .info) // Changed to .info
           } else {
               os_log("Failed to get fallback content for non-text message.", log: logger, type: .default)
               plaintext = "[Unsupported Content Type]"
           }
        }
      } catch {
         os_log("Error accessing or decoding encodedContent: %{public}@", log: logger, type: .error, error.localizedDescription)
         plaintext = "[Error Reading Content]"
      }

      // Set both title and body to the decrypted plaintext for now
      os_log(">>> Decrypted Plaintext: '%{public}@'", log: logger, type: .info, plaintext) // Log with quotes to see if empty
      currentBestAttempt.title = "New message"
      currentBestAttempt.body = plaintext

      os_log("Delivering decrypted notification.", log: logger, type: .info)
      contentHandler?(currentBestAttempt)


    } catch {
      os_log("Error during XMTP client build or message processing: %{public}@", log: logger, type: .error, error.localizedDescription)
      contentHandler?(currentBestAttempt)
    }
  }

  override func serviceExtensionTimeWillExpire() {
    os_log("serviceExtensionTimeWillExpire called", log: logger, type: .info) // Kept as .info
    if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
      contentHandler(bestAttempt)
    }
  }
}
