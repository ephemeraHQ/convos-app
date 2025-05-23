import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        SentryManager.shared.startSentry()
        SentryManager.shared.addBreadcrumb("Received a new notification")

        self.contentHandler = contentHandler
        self.bestAttempt = (request.content.mutableCopy() as? UNMutableNotificationContent)

        handleNotificationAsync(request: request)
    }

    // Main asynchronous processing logic
    private func handleNotificationAsync(request: UNNotificationRequest) {
        SentryManager.shared.addBreadcrumb("handleNotificationAsync called")
        guard let currentBestAttempt = bestAttempt else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to get mutable copy of notification content"))
            contentHandler?(request.content)
            return
        }

        // Ensure userInfo is not nil and can be cast to [String: Any]
        guard let userInfo = request.content.userInfo as? [String: Any] else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Could not extract userInfo as [String: Any] from notification content or userInfo is nil."))
            contentHandler?(request.content)
            return
        }

        SentryManager.shared.addBreadcrumb("Successfully extracted userInfo")

        let encryptedMessage: String
        let topic: String
        let ethAddress: String

        do {
            SentryManager.shared.addBreadcrumb("Attempting to decode notification payload")
            // Convert the userInfo dictionary to Data
            let jsonDataForDecoding = try JSONSerialization.data(
                withJSONObject: userInfo, options: [])

            // Decode the JSON data into our structs
            let decoder = JSONDecoder()
            let payload = try decoder.decode(NotificationPayload.self, from: jsonDataForDecoding)

            encryptedMessage = payload.body.encryptedMessage
            topic = payload.body.contentTopic
            ethAddress = payload.body.ethAddress.lowercased()
            SentryManager.shared.addBreadcrumb("Successfully decoded notification payload")

        } catch {
            // Log detailed error information if decoding fails
            SentryManager.shared.trackError(error, extras: ["info": "Failed to decode notification payload or extract required fields"])
            contentHandler?(request.content)
            return
        }

        // Make sure we have a valid ethAddress
        guard !ethAddress.isEmpty else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "ethAddress is empty after decoding, cannot proceed."))
            contentHandler?(request.content)
            return
        }
        SentryManager.shared.addBreadcrumb("ethAddress is valid")

        Task {
            SentryManager.shared.addBreadcrumb("Starting Task for XMTP processing")
            do {
                SentryManager.shared.addBreadcrumb("Attempting to create XMTP client for address: \(ethAddress)")
                // Note: Building the client might be resource-intensive for an NSE. Monitor performance.
              let client = try await Client.client(for: ethAddress)
                SentryManager.shared.addBreadcrumb("Successfully created XMTP client")

                // --- 4. Decrypt Message ---
                SentryManager.shared.addBreadcrumb("Attempting to find conversation by topic: \(topic)")

                guard
                    let conversation = try await client.conversations.findConversationByTopic(
                        topic: topic)
                else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Conversation not found for topic: \(topic)"))
                    contentHandler?(currentBestAttempt)
                    return
                }
                SentryManager.shared.addBreadcrumb("Conversation found for topic: \(topic)")

                SentryManager.shared.addBreadcrumb("Attempting to sync conversation")
                try await conversation.sync()
                SentryManager.shared.addBreadcrumb("Successfully synced conversation")

                guard let messageBytes = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to decode base64 encryptedMessage payload"))
                    contentHandler?(request.content); return
                }
                SentryManager.shared.addBreadcrumb("Successfully decoded base64 encryptedMessage payload")

                guard
                    let decodedMessage = try await conversation.processMessage(
                        messageBytes: messageBytes)
                else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to process message bytes for topic: \(topic)"))
                    contentHandler?(currentBestAttempt)
                    return
                }
                SentryManager.shared.addBreadcrumb("Successfully processed message bytes")

              let notificationFactory = PushNotificationContentFactory(client: client)
              SentryManager.shared.addBreadcrumb("Attempting to create notification content from decoded message")
              guard let notification = try await notificationFactory.notification(from: request.content,
                                                                                  with: decodedMessage,
                                                                                  in: conversation) else {
                SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed getting notification from decoded message for topic: \(topic)"))
                contentHandler?(currentBestAttempt)
                return
              }
              SentryManager.shared.addBreadcrumb("Successfully created notification content")

              prettyPrint(dictionary: notification.userInfo)

              SentryManager.shared.addBreadcrumb("Delivering decrypted notification with title: '\(notification.title)' and body: '\(notification.body)'")
              contentHandler?(notification)
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Failed to decode notification payload or extract required fields"])
                contentHandler?(currentBestAttempt)
            }
        }

    }

    override func serviceExtensionTimeWillExpire() {
        SentryManager.shared.addBreadcrumb("serviceExtensionTimeWillExpire called")
        SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "serviceExtensionTimeWillExpire called"))
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
