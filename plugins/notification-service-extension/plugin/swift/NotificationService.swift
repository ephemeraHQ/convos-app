import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    private static func storeDecryptedMessage(_ message: DecodedMessage, forTopic topic: String) {
        SentryManager.shared.addBreadcrumb("Attempting to store decrypted message")

        let conversationId = XmtpHelpers.shared.getConversationIdFromTopic(topic)
        
        // Get existing messages for this topic
        var existingMessages: [[String: Any]] = []
        // IF YOU CHANGE THIS KEY, YOU MUST CHANGE THE KEY IN THE MAIN APP TOO
        let storageKey = "conversation_messages_\(conversationId)"
        if let existingData = MMKVHelper.shared.getString(forKey: storageKey),
           let data = existingData.data(using: .utf8),
           let jsonArray = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            existingMessages = jsonArray
        }
        
        // Create message dictionary. Don't need all the fields because the main app will handle the rest.
        let messageDict: [String: Any] = [
            "id": message.id,
        ]
        
        // Add new message to the beginning of the array
        existingMessages.insert(messageDict, at: 0)
        
        // Keep only the last 20 messages to prevent unlimited growth
        if existingMessages.count > 20 {
            existingMessages = Array(existingMessages.prefix(20))
            SentryManager.shared.addBreadcrumb("Trimmed message history to 20 messages")
        }
        
        // Convert back to JSON string and store
        if let jsonData = try? JSONSerialization.data(withJSONObject: existingMessages),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            MMKVHelper.shared.setString(jsonString, forKey: storageKey)
            SentryManager.shared.addBreadcrumb("Successfully stored decrypted message")
        } else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to serialize message data for conversationId: \(conversationId)"))
        }
    }
    
    private static func unsubscribeFromTopics(_ topics: [String], installationId: String, reason: String) {
        guard !topics.isEmpty else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Topics array is empty"))
            return
        }
        
        guard !installationId.isEmpty else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Installation ID is empty or nil"))
            return
        }
        
        Task {
            do {
                try await ConvosAPIService.shared.unsubscribeFromTopics(
                    installationId: installationId,
                    topics: topics
                )
                SentryManager.shared.addBreadcrumb("Successfully unsubscribed from \(topics.count) topic(s) - Reason: \(reason)")
            } catch {
                SentryManager.shared.trackError(error, extras: [
                    "info": "Failed to unsubscribe from topics",
                    "reason": reason,
                    "topicCount": topics.count,
                    "installationId": installationId
                ])
            }
        }
    }

    // MARK: - UNNotificationServiceExtension Methods

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
        let installationId: String

        do {
            SentryManager.shared.addBreadcrumb("Attempting to decode notification payload")
            let jsonDataForDecoding = try JSONSerialization.data(withJSONObject: userInfo, options: [])
            let decoder = JSONDecoder()
            let payload = try decoder.decode(NotificationPayload.self, from: jsonDataForDecoding)

            encryptedMessage = payload.body.encryptedMessage
            topic = payload.body.contentTopic
            ethAddress = payload.body.ethAddress.lowercased()
            installationId = payload.body.installationId
            SentryManager.shared.addBreadcrumb("Successfully decoded notification payload")

        } catch {
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
            // Create XMTP client
            let client: Client
            do {
                SentryManager.shared.addBreadcrumb("Attempting to create XMTP client for address: \(ethAddress)")
                client = try await Client.client(for: ethAddress)
                SentryManager.shared.addBreadcrumb("Successfully created XMTP client")
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Failed to create XMTP client for address: \(ethAddress)"])
                
                NotificationService.unsubscribeFromTopics(
                    [topic],
                    installationId: installationId,
                    reason: "Failed to create XMTP client for address: \(ethAddress)"
                )
                
                SentryManager.shared.addBreadcrumb("Showing generic notification due to client creation failure")
                contentHandler?(currentBestAttempt)
                return
            }

            // Find conversation
            let conversation: Conversation
            do {
                SentryManager.shared.addBreadcrumb("Attempting to find conversation by topic: \(topic)")
                guard let foundConversation = try await client.conversations.findConversationByTopic(topic: topic) else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Conversation not found for topic: \(topic)"))
                    
                    // Unsubscribe because this conversation doesn't exist for this client
                    NotificationService.unsubscribeFromTopics(
                        [topic], 
                        installationId: client.installationID, 
                        reason: "Conversation not found for topic: \(topic)"
                    )
                    
                    contentHandler?(currentBestAttempt)
                    return
                }
                conversation = foundConversation
                SentryManager.shared.addBreadcrumb("Conversation found for topic: \(topic)")
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Error finding conversation for topic: \(topic)"])
                contentHandler?(currentBestAttempt)
                return
            }

             // Sync conversation
            do {
                SentryManager.shared.addBreadcrumb("Attempting to sync conversation")
                try await conversation.sync()
                SentryManager.shared.addBreadcrumb("Successfully synced conversation")
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Failed to sync conversation"])
                // Don't unsubscribe here - sync failures are temporary
                contentHandler?(currentBestAttempt)
                return
            }

            // Check group membership (if applicable) - unsubscribe if not a member
            switch conversation {
            case .group(let group):
                do {
                    SentryManager.shared.addBreadcrumb("Checking group membership for group conversation")
                    let isActive = try group.isActive()
                    guard isActive else {
                        SentryManager.shared.addBreadcrumb("User is no longer active in this group")
                        
                        NotificationService.unsubscribeFromTopics(
                            [topic], 
                            installationId: client.installationID, 
                            reason: "User no longer active in group"
                        )
                        
                        contentHandler?(currentBestAttempt)
                        return
                    }
                    SentryManager.shared.addBreadcrumb("User is still active in the group")
                } catch {
                    SentryManager.shared.trackError(error, extras: ["info": "Failed to check group membership"])
                    
                    // Unsubscribe on membership check failure as safety measure
                    NotificationService.unsubscribeFromTopics(
                        [topic], 
                        installationId: client.installationID, 
                        reason: "Failed to verify group membership"
                    )
                    
                    contentHandler?(currentBestAttempt)
                    return
                }
            case .dm(_):
                SentryManager.shared.addBreadcrumb("DM conversation, no need to verify conversation validity")
            }

            // Decode message
            let decodedMessage: DecodedMessage
            do {
                SentryManager.shared.addBreadcrumb("Attempting to decode base64 encryptedMessage payload")
                guard let messageBytes = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to decode base64 encryptedMessage payload"))
                    contentHandler?(request.content)
                    return
                }
                SentryManager.shared.addBreadcrumb("Successfully decoded base64 encryptedMessage payload")

                SentryManager.shared.addBreadcrumb("Attempting to decrypt message")
                guard let message = try await conversation.processMessage(messageBytes: messageBytes) else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to process message bytes for topic: \(topic)"))
                    contentHandler?(currentBestAttempt)
                    return
                }
                decodedMessage = message
                SentryManager.shared.addBreadcrumb("Successfully decrypted message")
                
                // Store the decrypted message in SharedDefaults
                NotificationService.storeDecryptedMessage(decodedMessage, forTopic: topic)
                
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Unexpected error during message processing"])
                contentHandler?(currentBestAttempt)
                return
            }

            // Create notification content
            do {
                SentryManager.shared.addBreadcrumb("Attempting to create notification content from decrypted message")
                let notificationFactory = PushNotificationContentFactory(client: client)
                guard let notification = try await notificationFactory.notification(from: request.content,
                                                                                  with: decodedMessage,
                                                                                  in: conversation) else {
                    SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed getting notification from decrypted message for topic: \(topic)"))
                    contentHandler?(currentBestAttempt)
                    return
                }
                SentryManager.shared.addBreadcrumb("Successfully created notification content from decrypted message")

                prettyPrint(dictionary: notification.userInfo)

                SentryManager.shared.addBreadcrumb("Delivering decrypted notification with title: '\(notification.title)' and body: '\(notification.body)'")
                contentHandler?(notification)
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Failed to create notification content"])
                contentHandler?(currentBestAttempt)
                return
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
        let installationId: String
    }

    struct NotificationPayload: Decodable {
        let body: NotificationBody
    }
}
