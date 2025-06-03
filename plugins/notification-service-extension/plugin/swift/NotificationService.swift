import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    // IF YOU CHANGE THIS KEY, YOU MUST CHANGE THE KEY IN THE MAIN APP TOO
    private static let CONVERSATION_MESSAGES_KEY_PREFIX = "conversation_messages_"

    private static func storeDecryptedMessage(_ message: DecodedMessage, forTopic topic: String) {
        SentryManager.shared.addBreadcrumb("Attempting to store decrypted message")
        let conversationId = XmtpHelpers.shared.getConversationIdFromTopic(topic)
        SentryManager.shared.addBreadcrumb("Got conversation ID: \(conversationId)")
        
        // Get existing messages for this topic
        var existingMessages: [[String: Any]] = []

        let storageKey = "\(NotificationService.CONVERSATION_MESSAGES_KEY_PREFIX)\(conversationId)"
        SentryManager.shared.addBreadcrumb("Attempting to retrieve existing messages for key: \(storageKey)")
        
        if let existingData = MMKVHelper.shared.getString(forKey: storageKey),
           let data = existingData.data(using: .utf8),
           let jsonArray = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            existingMessages = jsonArray
            SentryManager.shared.addBreadcrumb("Successfully retrieved \(existingMessages.count) existing messages")
        } else {
            SentryManager.shared.addBreadcrumb("No existing messages found or failed to parse")
        }
        
        do {
            SentryManager.shared.addBreadcrumb("Starting message content extraction")
            let decoder = XMTPContentDecoder()
            let decodedMessageType = try decoder.decode(message: message)
            let messageContentType = try message.encodedContent.type.description

            SentryManager.shared.addBreadcrumb("Successfully decoded message content with type \(messageContentType)")
            
            // Convert DecodedMessageType to serializable format that matches TypeScript types
            let serializableContent: [String: Any]
            switch decodedMessageType {
            case .text(let text):
                serializableContent = ["text": text]
                
            case .reply(let reply):
                var replyContent: [String: Any] = [
                    "reference": reply.reference
                ]
                
                // Use the contentType to determine how to handle the content
                switch reply.contentType {
                case ContentTypeText:
                    if let textContent = reply.content as? String {
                        replyContent["content"] = ["text": textContent]
                    } else {
                        replyContent["content"] = ["text": String(describing: reply.content)]
                    }
                    
                case ContentTypeRemoteAttachment:
                    if let remoteAttachment = reply.content as? RemoteAttachment {
                        var remoteAttachmentContent: [String: Any] = [
                            "url": remoteAttachment.url,
                            "secret": remoteAttachment.secret.base64EncodedString(),
                            "salt": remoteAttachment.salt.base64EncodedString(),
                            "nonce": remoteAttachment.nonce.base64EncodedString(),
                            "contentDigest": remoteAttachment.contentDigest,
                            "scheme": "https://"
                        ]
                        
                        if let filename = remoteAttachment.filename {
                            remoteAttachmentContent["filename"] = filename
                        }
                        if let contentLength = remoteAttachment.contentLength {
                            remoteAttachmentContent["contentLength"] = String(contentLength)
                        }
                        
                        replyContent["content"] = remoteAttachmentContent
                    } else {
                        replyContent["content"] = ["text": String(describing: reply.content)]
                    }
                    
                case ContentTypeAttachment:
                    if let attachment = reply.content as? Attachment {
                        let attachmentContent: [String: Any] = [
                            "filename": attachment.filename,
                            "mimeType": attachment.mimeType,
                            "data": attachment.data.base64EncodedString()
                        ]
                        replyContent["content"] = attachmentContent
                    } else {
                        replyContent["content"] = ["text": String(describing: reply.content)]
                    }
                    
                case ContentTypeMultiRemoteAttachment:
                    if let multiRemoteAttachment = reply.content as? MultiRemoteAttachment {
                        let attachments = multiRemoteAttachment.remoteAttachments.map { attachment in
                            [
                                "url": attachment.url,
                                "secret": attachment.secret.base64EncodedString(),
                                "salt": attachment.salt.base64EncodedString(),
                                "nonce": attachment.nonce.base64EncodedString(),
                                "contentDigest": attachment.contentDigest,
                                "scheme": attachment.scheme,
                                "filename": attachment.filename,
                                "contentLength": String(attachment.contentLength)
                            ] as [String: Any]
                        }
                        replyContent["content"] = ["attachments": attachments]
                    } else {
                        replyContent["content"] = ["text": String(describing: reply.content)]
                    }
                    
                default:
                    // Fallback for unknown content types
                    replyContent["content"] = ["text": String(describing: reply.content)]
                }
                
                serializableContent = ["reply": replyContent]
                
            case .reaction(let reaction):
                let reactionContent: [String: Any] = [
                    "reference": reaction.reference,
                    "action": reaction.action.rawValue,
                    "schema": reaction.schema.rawValue,
                    "content": reaction.content
                ]
                serializableContent = ["reaction": reactionContent]
                
            case .attachment(let attachment):
                let attachmentContent: [String: Any] = [
                    "filename": attachment.filename,
                    "mimeType": attachment.mimeType,
                    "data": attachment.data.base64EncodedString()
                ]
                serializableContent = ["attachment": attachmentContent]
                
            case .remoteAttachment(let remoteAttachment):
                var remoteAttachmentContent: [String: Any] = [
                    "url": remoteAttachment.url,
                    "secret": remoteAttachment.secret.base64EncodedString(),
                    "salt": remoteAttachment.salt.base64EncodedString(),
                    "nonce": remoteAttachment.nonce.base64EncodedString(),
                    "contentDigest": remoteAttachment.contentDigest,
                    "scheme": "https://"
                ]
                
                if let filename = remoteAttachment.filename {
                    remoteAttachmentContent["filename"] = filename
                }
                if let contentLength = remoteAttachment.contentLength {
                    remoteAttachmentContent["contentLength"] = contentLength
                }
                
                serializableContent = ["remoteAttachment": remoteAttachmentContent]
                
            case .remoteURL(let url):
                serializableContent = ["remoteURL": url.absoluteString]
                
            case .multiRemoteAttachment(let multiRemoteAttachment):
                let attachments = multiRemoteAttachment.remoteAttachments.map { attachment in
                    [
                        "url": attachment.url,
                        "secret": attachment.secret.base64EncodedString(),
                        "salt": attachment.salt.base64EncodedString(),
                        "nonce": attachment.nonce.base64EncodedString(),
                        "contentDigest": attachment.contentDigest,
                        "scheme": attachment.scheme,
                        "filename": attachment.filename,
                        "contentLength": String(attachment.contentLength)
                    ] as [String: Any]
                }
                serializableContent = ["multiRemoteAttachment": ["attachments": attachments]]
                
            case .unknown:
                serializableContent = ["unknown": ["contentTypeId": "unknown"]]
            }

            SentryManager.shared.addBreadcrumb("Attempting to create message dictionary with content: \(serializableContent) and contentType: \(messageContentType)")
            
            let messageDict: [String: Any] = [
                "id": message.id,
                "content": serializableContent,
                "contentType": messageContentType,
                "sentAtNs": message.sentAtNs,
                "senderInboxId": message.senderInboxId
            ]
            SentryManager.shared.addBreadcrumb("Created message dictionary")
            
            existingMessages.insert(messageDict, at: 0)
            SentryManager.shared.addBreadcrumb("Inserted new message at beginning of array")
            
            if existingMessages.count > 20 {
                existingMessages = Array(existingMessages.prefix(20))
                SentryManager.shared.addBreadcrumb("Trimmed message history to 20 messages")
            } else {
                SentryManager.shared.addBreadcrumb("Message history is less than 20 messages, no need to trim")
            }
            
            
            let jsonData = try JSONSerialization.data(withJSONObject: existingMessages)
            let jsonString = String(data: jsonData, encoding: .utf8)
            
            if let jsonString = jsonString {
                MMKVHelper.shared.setString(jsonString, forKey: storageKey)
                SentryManager.shared.addBreadcrumb("Successfully stored decrypted message")
            } else {
                SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to convert JSON data to string for conversationId: \(conversationId)"))
            }

        } catch {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Failed to extract and store message content: \(error)"))
        }
    }
    
    private static func unsubscribeFromTopics(_ topics: [String], ethAddress: String, reason: String) async {
        guard !topics.isEmpty else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "Topics array is empty"))
            return
        }
        
        guard !ethAddress.isEmpty else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "NotificationService", description: "ethAddress is empty or nil"))
            return
        }
        
        do {
            try await ConvosAPIService.shared.unsubscribeFromTopics(
                ethAddress: ethAddress,
                topics: topics
            )
            SentryManager.shared.addBreadcrumb("Successfully unsubscribed from \(topics.count) topic(s) - Reason: \(reason)")
        } catch {
            SentryManager.shared.trackError(error, extras: [
                "info": "Failed to unsubscribe from topics",
                "reason": reason,
                "topicCount": topics.count,
                "ethAddress": ethAddress
            ])
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
        let installationId: String?

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
                SentryManager.shared.addBreadcrumb("Attempting to create/get XMTP client for address: \(ethAddress)")
                client = try await Client.client(for: ethAddress)
                SentryManager.shared.addBreadcrumb("Successfully created/got XMTP client for address: \(ethAddress)")
            } catch {
                // Check if this is a no encryption key error and we have an installation ID
                if let clientError = error as? Client.ClientInitializationError,
                   clientError == .noEncryptionKey,
                   let installationId = installationId {
                    
                    SentryManager.shared.addBreadcrumb("No encryption key found, attempting to unregister notification installation")
                    
                    do {
                        try await ConvosAPIService.shared.unregisterNotificationInstallation(
                            ethAddress: ethAddress,
                            installationId: installationId
                        )
                        SentryManager.shared.addBreadcrumb("Successfully unregistered notification installation for \(ethAddress)")
                    } catch {
                        SentryManager.shared.trackError(error, extras: [
                            "operation": "unregisterNotificationInstallation",
                            "ethAddress": ethAddress,
                            "installationId": installationId,
                            "originalError": "noEncryptionKey"
                        ])
                    }
                } else if installationId == nil {
                    SentryManager.shared.addBreadcrumb("No encryption key found but no installation ID available to unregister")
                }
                
                SentryManager.shared.trackError(error, extras: ["info": "Failed to create XMTP client for address: \(ethAddress)"])
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
                    await NotificationService.unsubscribeFromTopics(
                        [topic],
                        ethAddress: ethAddress,
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
                try await withRetry(context: "Syncing conversation for topic: \(topic)") {
                    try await conversation.sync()
                }
                SentryManager.shared.addBreadcrumb("Successfully synced conversation")
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Failed to sync conversation"])
                // If sync fails, we still want to continue because syncing might not be needed!
            }

            // Check if group is still active meaning the user is still a member
            switch conversation {
            case .group(let group):
                do {
                    SentryManager.shared.addBreadcrumb("Checking group membership for group conversation")
                    let isActive = try group.isActive()
                    guard isActive else {
                        SentryManager.shared.addBreadcrumb("User is no longer active in this group")
                        
                        await NotificationService.unsubscribeFromTopics(
                            [topic],
                            ethAddress: ethAddress,
                            reason: "User no longer active in group"
                        )
                        
                        contentHandler?(currentBestAttempt)
                        return
                    }
                    SentryManager.shared.addBreadcrumb("User is still active in the group")
                } catch {
                    SentryManager.shared.trackError(error, extras: ["info": "Failed to check group membership"])
                    
                    // This is a safety measure to prevent the user from receiving notifications for a group that they are no longer a member of
                    await NotificationService.unsubscribeFromTopics(
                        [topic],
                        ethAddress: ethAddress,
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
                
                // Store the decrypted message so that the main app can display it faster
                NotificationService.storeDecryptedMessage(decodedMessage, forTopic: topic)
                
            } catch {
                SentryManager.shared.trackError(error, extras: ["info": "Unexpected error during message processing"])
                contentHandler?(currentBestAttempt)
                return
            }

            // Create notification content
            do {
                SentryManager.shared.addBreadcrumb("Attempting to create notification content from decrypted message")
                guard let notification = try await PushNotificationContentFactory.notification(
                    from: request.content,
                    with: decodedMessage,
                    in: conversation,
                    ethAddress: ethAddress
                ) else {
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
        let installationId: String?
    }

    struct NotificationPayload: Decodable {
        let body: NotificationBody
    }
}
