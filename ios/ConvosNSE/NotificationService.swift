import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    // Add function to fetch username
    private func fetchUsername(forInboxId inboxId: String) async -> String? {
        do {
            // Get the API URL from the environment
            // ProcessInfo.processInfo.environment["CONVOS_API_URL"] ?? "https://api.convos-dev.convos-api.xyz"
            let url = URL(
                string:
                    "https://api.convos-dev.convos-api.xyz/api/v1/profiles/public/xmtpId/\(inboxId)"
            )!

            let (data, response) = try await URLSession.shared.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse else {
                log.error("Failed to get HTTP response for inboxId \(inboxId)")
                return nil
            }

            guard httpResponse.statusCode == 200 else {
                log.error(
                    "Failed to fetch username for inboxId \(inboxId). HTTP Response: \(httpResponse)"
                )
                return nil
            }

            // Parse the JSON response
            let decoder = JSONDecoder()
            let profile = try decoder.decode(ProfileResponse.self, from: data)
            return profile.username
        } catch {
            log.error("Failed to fetch username for inboxId \(inboxId)", error: error)
            return nil
        }
    }

    // Add response model
    private struct ProfileResponse: Codable {
        let username: String
    }

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        log.debug("didReceive called for request ID: \(request.identifier)")
        log.debug("Full UNNotificationRequest content:\n\(request.content.description)")

        self.contentHandler = contentHandler
        self.bestAttempt = (request.content.mutableCopy() as? UNMutableNotificationContent)

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
            log.error(
                "Could not extract userInfo as [String: Any] from notification content or userInfo is nil."
            )
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
            let jsonDataForDecoding = try JSONSerialization.data(
                withJSONObject: userInfo, options: [])

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
              guard let client = await getXmtpClient(ethAddress: ethAddress) else {
                log.error("Failed building XMTP Client")
                contentHandler?(currentBestAttempt)
                return
              }

              Client.register(codec: ReplyCodec())
              Client.register(codec: ReactionCodec())
              Client.register(codec: ReactionV2Codec())
              Client.register(codec: AttachmentCodec())
              Client.register(codec: RemoteAttachmentCodec())

                // --- 4. Decrypt Message ---
                log.debug("Attempting to find conversation by topic: ", topic)

                guard
                    let conversation = try await client.conversations.findConversationByTopic(
                        topic: topic)
                else {
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

                guard
                    let decodedMessage = try await conversation.processMessage(
                        messageBytes: messageBytes)
                else {
                    log.error("Failed to process message bytes for topic: ", topic)
                    contentHandler?(currentBestAttempt)
                    return
                }

              let notificationFactory = PushNotificationContentFactory(client: client)
              guard let notification = try await notificationFactory.notification(from: decodedMessage, in: conversation) else {
                log.error("Failed getting notification from decoded message")
                contentHandler?(currentBestAttempt)
                return
              }

              prettyPrint(dictionary: notification.userInfo)
              log.debug("Current notification content: ", notification.description)

              log.debug(
                "Delivering decrypted notification with title:",
                "'\(notification.title)'",
                "and body:", "'\(notification.body)'")
              log.debug(
                "Final notification content: ",
                String(describing: notification.debugDescription))
              log.debug(
                "Final notification content.userInfo: ",
                getPrettyPrintString(dictionary: notification.userInfo))

              contentHandler?(notification)
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
