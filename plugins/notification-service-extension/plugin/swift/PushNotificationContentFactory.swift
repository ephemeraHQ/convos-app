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

class ProfileNameResolver {
    private struct Response: Codable {
      let name: String?
      let username: String
    }

    let apiBaseURL: String

    static var shared: ProfileNameResolver = .init(environment: XMTP.Client.xmtpEnvironment)

    private init(environment: XMTPEnvironment) {
        switch environment {
        case .production:
            apiBaseURL = "https://api.convos-prod.convos-api.xyz"
        case .local, .dev:
            apiBaseURL = "https://api.convos-dev.convos-api.xyz"
        }
    }

    func resolveProfileName(for inboxId: String) async -> String? {
        do {
            guard let url = URL(
                string:
                    "\(apiBaseURL)/api/v1/profiles/public/xmtpId/\(inboxId)"
            ) else {
                SentryManager.shared.trackMessage("Failed to create API URL for inboxId \(inboxId)")
                return nil
            }

            let (data, response) = try await URLSession.shared.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse else {
                SentryManager.shared.trackMessage("Failed to get HTTP response for inboxId \(inboxId)")
                return nil
            }

            guard httpResponse.statusCode == 200 else {
                SentryManager.shared.trackMessage(
                    "Failed to fetch username for inboxId \(inboxId). HTTP Response: \(httpResponse)"
                )
                return nil
            }

            // Parse the JSON response
            let decoder = JSONDecoder()
            let profile = try decoder.decode(Response.self, from: data)
          return profile.name ?? profile.username
        } catch {
            SentryManager.shared.trackError(error, extras: ["info": "Failed to fetch username for inboxId \(inboxId)"])
            return nil
        }
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
    let client: Client
    let nameResolver: ProfileNameResolver

    init(client: Client) {
        self.client = client
        self.nameResolver = ProfileNameResolver.shared
    }

    private func message(from reference: String) async throws -> DecodedMessage? {
        try await client.conversations.sync()
        return try await client.conversations.findMessage(messageId: reference)
    }

  func notification(from originalNotification: UNNotificationContent,
                    with decodedMessage: DecodedMessage,
                    in conversation: Conversation) async throws -> UNNotificationContent? {
        let mutableNotification = originalNotification.mutableCopy() as? UNMutableNotificationContent ?? UNMutableNotificationContent()
        let decoder = XMTPContentDecoder()
        let content = try decoder.decode(message: decodedMessage)

        mutableNotification.threadIdentifier = conversation.id

        // skip our own messages
        guard decodedMessage.senderInboxId != client.inboxID else {
            return nil
        }

        let profileName = await nameResolver.resolveProfileName(for: decodedMessage.senderInboxId)
        mutableNotification.title = profileName ?? "Convos" // default title is Sender's name

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
            if let originalMessage = try await message(from: originalMessageId) {
                let originalContentType = try originalMessage.encodedContent.type
                switch originalContentType {
                case ContentTypeText:
                    let originalMessageBody: String = try originalMessage.content()
                    let senderString: String
                    switch conversation {
                    case .group(_):
                        if originalMessage.senderInboxId == client.inboxID {
                            senderString = "you "
                        } else if let senderName = await nameResolver.resolveProfileName(
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
                        mutableNotification.body = "Replied to \(senderString)\"\(originalMessageBody)\"" // unknown reply type?
                    }
                case ContentTypeRemoteAttachment: // replying to media
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
            let originalMessage = try await message(from: originalMessageId)
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
            case ContentTypeRemoteAttachment: // replying to media
                if isYou {
                    body = "your photo"
                } else if case .group(_) = conversation, let originalMessage,
                          let senderName = await nameResolver.resolveProfileName(
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
                          let senderName = await nameResolver.resolveProfileName(
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
          }
            mutableNotification.body = "Sent a photo"
        case .remoteURL(_):
          mutableNotification.body = "Sent a photo"

        case .unknown:
            return nil
        }
        return mutableNotification
    }
}
