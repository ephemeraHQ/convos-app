import Foundation
import XMTP

extension Reaction: @retroactive Equatable {
    public static func == (lhs: Reaction, rhs: Reaction) -> Bool {
        return (lhs.content == rhs.content &&
                lhs.action == rhs.action &&
                lhs.reference == rhs.reference &&
                lhs.schema == rhs.schema)
    }
}

extension Reply: @retroactive Equatable {
    public static func == (lhs: Reply, rhs: Reply) -> Bool {
        guard let lhsContent = lhs.content as? String,
              let rhsContent = rhs.content as? String else {
            return false
        }
        return (lhsContent == rhsContent &&
                lhs.reference == rhs.reference &&
                lhs.contentType == rhs.contentType)
    }
}

extension Attachment: @retroactive Equatable {
    public static func == (lhs: Attachment, rhs: Attachment) -> Bool {
        return (lhs.filename == rhs.filename &&
                lhs.mimeType == rhs.mimeType &&
                lhs.data == rhs.data)
    }
}

extension RemoteAttachment: @retroactive Equatable {
    public static func == (lhs: RemoteAttachment, rhs: RemoteAttachment) -> Bool {
        return (lhs.url == rhs.url &&
                lhs.contentDigest == rhs.contentDigest &&
                lhs.contentLength == rhs.contentLength &&
                lhs.filename == rhs.filename &&
                lhs.salt == rhs.salt &&
                lhs.nonce == rhs.nonce)
    }
}

class XMTPContentDecoder {
    enum XMTPDecoderError: Error {
        case missingContentType(String)
        case mismatchedContentType(String)
    }

    enum DecodedMessageType: Equatable {
        case text(String),
             reply(Reply),
             reaction(Reaction),
             attachment(Attachment),
             remoteAttachment(RemoteAttachment),
             remoteURL(URL),
             unknown
    }

    func decode(message: DecodedMessage) throws -> DecodedMessageType {
        let content = try message.content() as Any
        let encodedContentType = try message.encodedContent.type
        switch encodedContentType {
        case ContentTypeText:
            guard let contentString = content as? String else {
                throw XMTPDecoderError.mismatchedContentType("Could not decode content as string")
            }
            return .text(contentString)
        case ContentTypeReply:
            guard let contentReply = content as? Reply else {
                throw XMTPDecoderError.mismatchedContentType("Could not decode content as reply")
            }
            return .reply(contentReply)
        case ContentTypeReaction, ContentTypeReactionV2:
            guard let reaction = content as? Reaction else {
                throw XMTPDecoderError.mismatchedContentType("Could not decode content as reaction")
            }
            return .reaction(reaction)
        case ContentTypeAttachment:
            guard let attachment = content as? Attachment else {
                throw XMTPDecoderError.mismatchedContentType("Could not decode content as attachment")
            }
            return .attachment(attachment)
        case ContentTypeRemoteAttachment:
          if let remoteAttachment = content as? RemoteAttachment {
            return .remoteAttachment(remoteAttachment)
          } else if let urlString = content as? String,
                    let url = URL(string: urlString) {
            return .remoteURL(url)
          } else {
            fallthrough
          }
        default:
            return .unknown
        }
    }
}
