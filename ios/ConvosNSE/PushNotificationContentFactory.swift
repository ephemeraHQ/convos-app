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

    static let shared = ProfileNameResolver()

    private init() {}

    func resolveProfileName(for inboxId: String) async -> String? {
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
            let profile = try decoder.decode(Response.self, from: data)
          return profile.name ?? profile.username
        } catch {
            log.error("Failed to fetch username for inboxId \(inboxId)", error: error)
            return nil
        }
    }
}

extension Group {
    var memberNames: [String?] {
        get async throws {
            let members = try await members
            let memberInboxIds = members.map { $0.inboxId }
            return await withTaskGroup(of: String?.self) { group in
                for id in memberInboxIds {
                    group.addTask {
                        await ProfileNameResolver.shared.resolveProfileName(for: id)
                    }
                }

                var names: [String?] = []
                for await name in group {
                    names.append(name)
                }
                return names
            }
        }
    }

    /// if you set `currentInboxId`, that member's profile name will be replaced with "You"
    func membersString(for currentInboxId: String? = nil,
                     excluding: [String] = []) async throws -> String {
        let excludingSet = Set(excluding)
        let members = try await members

        let maxMemberNamesToShow: Int = 5

        // Build the list with currentInboxId first
        var memberInboxIds = members.map { $0.inboxId }
        if let currentInboxId, let idx = memberInboxIds.firstIndex(of: currentInboxId) {
            memberInboxIds.remove(at: idx)
            memberInboxIds.insert(currentInboxId, at: 0)
        }

        // Remove excluded IDs (except currentInboxId)
        memberInboxIds = memberInboxIds.filter { !excludingSet.contains($0) }

        // Show a max number of members, but always include currentInboxId if present
        let limitedMemberInboxIds: [String]
        if let currentInboxId, memberInboxIds.first == currentInboxId {
            limitedMemberInboxIds = [currentInboxId] + Array(memberInboxIds.dropFirst()).prefix(maxMemberNamesToShow - 1)
        } else {
            limitedMemberInboxIds = Array(memberInboxIds.prefix(maxMemberNamesToShow))
        }
        let numberOfOthers = members.count - limitedMemberInboxIds.count - (currentInboxId == nil ? 0 : 1)

        let replaceWithString: String = "you"
        return await withTaskGroup(of: (String, String?).self) { group in
            for id in memberInboxIds {
                group.addTask {
                    let name = await ProfileNameResolver.shared.resolveProfileName(for: id)
                    return (id, name)
                }
            }

            var namesDict: [String: String] = [:]
            var unknownCount = numberOfOthers
            for await (id, name) in group {
                if let name {
                    namesDict[id] = name
                } else {
                    unknownCount += 1
                }
            }

            // empty profile names
            guard !namesDict.isEmpty else {
                if currentInboxId == nil {
                    return "No members"
                } else {
                    return "You and \(unknownCount) others"
                }
            }

            // Build the names array, replacing with a string if needed
            var names = memberInboxIds.map { id in
                if let currentInboxId, id == currentInboxId {
                    return replaceWithString
                } else {
                    return namesDict[id] ?? id
                }
            }
            // Move "You" to the front if present
            if let youIndex = names.firstIndex(of: replaceWithString) {
                let you = names.remove(at: youIndex)
                names.insert(you, at: 0)
            }
            if unknownCount > 0 {
                names.append("\(unknownCount) \(unknownCount == 1 ? "other" : "others")")
            }
            return ((names.count == 2) ?
                    names.joined(separator: " and ") :
                        names.joined(separator: ", "))
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

    init(client: Client) {
        self.client = client
    }

    private var nameResolver: ProfileNameResolver {
        ProfileNameResolver.shared
    }

    private func message(from reference: String) async throws -> DecodedMessage? {
        try await client.conversations.sync()
        return try await client.conversations.findMessage(messageId: reference)
    }

    func notification(from decodedMessage: DecodedMessage,
                      in conversation: Conversation) async throws -> UNNotificationContent? {
        let mutableNotification = UNMutableNotificationContent()
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
