import Foundation
import UniformTypeIdentifiers
import UserNotifications
import XMTP

extension Attachment {
  func saveToTmpFile() throws -> URL {
    let tempDir = FileManager.default.temporaryDirectory
    let fileName = UUID().uuidString + filename
    let fileURL = tempDir.appendingPathComponent(fileName)
    try data.write(to: fileURL)
    return fileURL
  }
}

extension Reaction {
    var emoji: String {
        switch schema {
        case .unicode:
            if let scalarValue = UInt32(content.replacingOccurrences(of: "U+", with: ""), radix: 16),
               let scalar = UnicodeScalar(scalarValue) {
                return String(scalar)
            }
        default:
            break
        }
        return content
    }
}

class PushNotificationContentFactory {
    
    static func notification(from originalNotification: UNNotificationContent,
                           with decodedMessage: DecodedMessage,
                           in conversation: Conversation,
                           ethAddress: String) async throws -> UNNotificationContent? {
        SentryManager.shared.addBreadcrumb("Attempting to create notification content from decrypted message")
        
        let client = try await Client.client(for: ethAddress)
        let mutableNotification = originalNotification.mutableCopy() as? UNMutableNotificationContent ?? UNMutableNotificationContent()
        let decoder = XMTPContentDecoder()
        let content = try decoder.decode(message: decodedMessage)

        mutableNotification.threadIdentifier = conversation.id

        guard decodedMessage.senderInboxId != client.inboxID else {
            return nil
        }

        let profileName = await ProfileNameResolver.shared.resolveProfileName(for: decodedMessage.senderInboxId)
        mutableNotification.title = profileName ?? "Convos"

        switch conversation {
        case .group(let group):
            let groupName = try group.name()
            if groupName.isEmpty {
                let groupString = try await group
                    .membersString(for: client.inboxID,
                                   excluding: [decodedMessage.senderInboxId])
                mutableNotification.subtitle = "To \(groupString)"
            } else {
                mutableNotification.subtitle = groupName
            }
        case .dm(_):
            break
        }

        switch content {
        case .text(let text):
            mutableNotification.body = text

        case .reply(let reply):
            let originalMessageId = reply.reference
            if let originalMessage = try await XmtpHelpers.shared.findMessage(from: originalMessageId, ethAddress: ethAddress) {
                let originalContentType = try originalMessage.encodedContent.type
                switch originalContentType {
                case ContentTypeText:
                    let originalMessageBody: String = try originalMessage.content()
                    let senderString: String
                    switch conversation {
                    case .group(_):
                        if originalMessage.senderInboxId == client.inboxID {
                            senderString = "you "
                        } else if let senderName = await ProfileNameResolver.shared.resolveProfileName(
                            for: originalMessage.senderInboxId
                        ) {
                            senderString = "\(senderName) "
                        } else {
                            senderString = ""
                        }
                    case .dm(_):
                        senderString = ""
                    }
                    if let replyString: String = reply.content as? String {
                        mutableNotification.body = "Replied to \(senderString)\"\(originalMessageBody)\": \(replyString)"
                    } else {
                        mutableNotification.body = "Replied to \(senderString)\"\(originalMessageBody)\""
                    }
                case ContentTypeRemoteAttachment:
                    let isYou = originalMessage.senderInboxId == client.inboxID
                    let replyString: String
                    if let reply = reply.content as? String {
                        replyString = "\"\(reply)\" "
                    } else {
                        replyString = ""
                    }
                    mutableNotification.body = isYou ? "Replied \(replyString)to your photo" : "Replied \(replyString)to a photo"
                default:
                    break
                }
            } else {
                mutableNotification.body = reply.content as? String ?? "Replied to an earlier message"
            }

        case .reaction(let reaction):
            let originalMessageId = reaction.reference
            let originalMessage = try await XmtpHelpers.shared.findMessage(from: originalMessageId, ethAddress: ethAddress)
            let isYou = originalMessage?.senderInboxId == client.inboxID
            let originalContentType = try originalMessage?.encodedContent.type
            let body: String
            switch originalContentType {
            case ContentTypeText:
                if let originalMessage {
                    let original: String = try originalMessage.content()
                    body = "\"\(original)\""
                } else {
                    fallthrough
                }
            case ContentTypeRemoteAttachment:
                if isYou {
                    body = "your photo"
                } else if case .group(_) = conversation, let originalMessage,
                          let senderName = await ProfileNameResolver.shared.resolveProfileName(
                            for: originalMessage.senderInboxId
                          ) {
                    body = "\(senderName)'s photo"
                } else {
                    body = "a photo"
                }
            default:
                if isYou {
                    body = "your message"
                } else if case .group(_) = conversation, let originalMessage,
                          let senderName = await ProfileNameResolver.shared.resolveProfileName(
                            for: originalMessage.senderInboxId
                          ) {
                    body = "\(senderName)'s message"
                } else {
                    body = "an earlier message"
                }
            }

            switch reaction.action {
            case .added:
                mutableNotification.body = "\(reaction.emoji)'d " + body
            case .removed:
                mutableNotification.body = "Removed \(reaction.emoji) from " + body
            case .unknown:
                break
            }

        case .attachment(_):
            mutableNotification.body = "Sent an attachment"

        case .remoteAttachment(let remoteAttachment):
          if let encodedContent: EncodedContent = try? await remoteAttachment.content(),
             let attachment: Attachment = try? encodedContent.decoded(),
             let localURL = try? attachment.saveToTmpFile() {
            let attachment: UNNotificationAttachment = try .init(identifier: decodedMessage.id,
                                                                 url: localURL,
                                                                 options: [
                                                                  UNNotificationAttachmentOptionsTypeHintKey: UTType.image
                                                                 ])
            mutableNotification.attachments = [attachment]
          } else {
            SentryManager.shared.trackError(ErrorFactory.create(domain: "PushNotificationContentFactory", description: "Failed to process remote attachment"))
          }
            mutableNotification.body = "Sent a photo"
        case .remoteURL(_):
          mutableNotification.body = "Sent a photo"

        case .unknown:
            SentryManager.shared.trackError(ErrorFactory.create(domain: "PushNotificationContentFactory", description: "Unknown message content type"))
            return nil
        }
        
        SentryManager.shared.addBreadcrumb("Successfully created notification content from decrypted message")

        return mutableNotification
    }
}
