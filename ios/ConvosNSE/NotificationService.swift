import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt:   UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        log.debug("didReceive called for request ID: \(request.identifier)")
        log.debug("Full UNNotificationRequest content:\n\(request.content.description)")

        self.contentHandler = contentHandler
        self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

        handleNotificationAsync(request: request)
    }

    // Main asynchronous processing logic
    private func handleNotificationAsync(request: UNNotificationRequest) {
        guard let currentBestAttempt = bestAttempt else {
            log.error("Failed to get mutable copy of notification content")
            contentHandler?(request.content)
            return
        }

        // Ensure userInfo is not nil and can be cast to [String: Any]
        guard let userInfo = request.content.userInfo as? [String: Any] else {
            log.error("Could not extract userInfo as [String: Any] from notification content or userInfo is nil.")
            contentHandler?(request.content)
            return
        }

        // Log the received userInfo for debugging
        log.debug("Received notification userInfo: \(getPrettyPrintString(dictionary: userInfo))")

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
            log.error("Failed to decode notification payload or extract required fields:", error)
            contentHandler?(request.content)
            return
        }

        // Make sure we have a valid ethAddress
        guard !ethAddress.isEmpty else {
            log.error("ethAddress is empty after decoding, cannot proceed.")
            contentHandler?(request.content)
            return
        }

        Task {
            do {
                // Note: Building the client might be resource-intensive for an NSE. Monitor performance.
                let client = await getXmtpClient(ethAddress: ethAddress)

                // --- 4. Decrypt Message ---
                log.debug("Attempting to find conversation by topic: ", topic)

                guard let conversation = try await client?.conversations.findConversationByTopic(topic: topic) else {
                    log.error("Conversation not found for topic: ", topic)
                    contentHandler?(currentBestAttempt)
                    return
                }

                log.debug("Conversation found. Syncing...")
                try await conversation.sync()

                guard let messageBytes = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
                    log.error("Failed to decode base64 encryptedMessage payload")
                    contentHandler?(request.content); return
                }

                log.debug("Decoded message bytes.")

                guard let decodedMessage = try await conversation.processMessage(messageBytes: messageBytes) else {
                    log.error("Failed to process message bytes for topic: ", topic)
                    contentHandler?(currentBestAttempt)
                    return
                }

                // --- 5. Update Notification Content ---
                var plaintext = "[Encrypted Content]" // Default

                do {
                    let currentEncodedContent = try decodedMessage.encodedContent
                    if currentEncodedContent.type == ContentTypeText {
                        let textContent: String? = try decodedMessage.content()
                        if let textContent {
                            plaintext = textContent
                            log.debug("Successfully decrypted text message: ", plaintext)
                        } else {
                            log.warn("Failed to decode text message content as String. Trying fallback....")
                            let fallbackText: String? = try decodedMessage.fallback
                            if let fallbackText {
                                plaintext = fallbackText
                                log.warn("Used fallback content for text message: ", plaintext)
                            } else {
                                log.warn("Failed to get fallback content for text message as well")
                                plaintext = "[Decryption/Format Error]"
                            }
                        }
                    } else {
                        let contentType = "\(currentEncodedContent.type.authorityID)/\(currentEncodedContent.type.typeID):\(currentEncodedContent.type.versionMajor).\(currentEncodedContent.type.versionMinor)"
                        log.warn("Received non-text message type: ", contentType)
                        let fallbackText: String? = try decodedMessage.fallback
                        if let fallbackText {
                            plaintext = fallbackText
                            log.debug("Used fallback content for non-text message: ", plaintext)
                        } else {
                            plaintext = "[Unsupported Content Type]"
                            log.warn("No fallback content available for non-text message. Using: ", plaintext)
                        }
                    }
                } catch {
                    log.error("Error accessing encodedContent or decoding message: ", error: error)
                    plaintext = "[Error Reading Content]"
                }

                // Set both title and body to the decrypted plaintext for now
                log.debug(">>> Decrypted Plaintext:", "'\(plaintext)'") // Log with quotes to see if empty
                currentBestAttempt.title = "New message"
                currentBestAttempt.body = plaintext

                prettyPrint(dictionary: currentBestAttempt.userInfo)
                log.debug("Current notification content: ", currentBestAttempt.description)

                log.debug("Delivering decrypted notification with title:", "'\(currentBestAttempt.title)'",
                          "and body:", "'\(currentBestAttempt.body)'")
                log.debug("Final notification content: ", String(describing: currentBestAttempt.debugDescription))
                log.debug("Final notification content.userInfo: ", getPrettyPrintString(dictionary: currentBestAttempt.userInfo))
                contentHandler?(currentBestAttempt)
            } catch {
                log.error("Error during XMTP client build or message processing: ", error: error)
                contentHandler?(currentBestAttempt)
            }
        }

    }

    override func serviceExtensionTimeWillExpire() {
        log.warn("serviceExtensionTimeWillExpire called")
        if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
            contentHandler(bestAttempt)
        }
    }
}

extension NotificationService {
    // Define Decodable structs for parsing the notification payload.
    struct NotificationBody: Decodable {
        let encryptedMessage: String
        let contentTopic: String
        let ethAddress: String
    }

    struct NotificationPayload: Decodable {
        let body: NotificationBody
    }
}
