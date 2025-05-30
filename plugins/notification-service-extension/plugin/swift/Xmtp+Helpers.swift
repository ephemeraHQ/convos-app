import Foundation
import XMTP

final class XmtpHelpers {
    static let shared = XmtpHelpers()
    
    private init() {}
    
    func getEnvironment() -> XMTPEnvironment {
        let environment = Bundle.getEnv()
        
        switch environment {
        case .development:
            return .local
        case .preview:
            return .dev
        case .production:
            return .production
        }
    }
    
    func getConversationIdFromTopic(_ topic: String) -> String {
        let prefix = "/xmtp/mls/1/g-"
        return topic.replacingOccurrences(of: prefix, with: "")
                   .replacingOccurrences(of: "/proto", with: "")
    }
    
    func findMessage(from reference: String, ethAddress: String) async throws -> DecodedMessage? {
        let client = try await Client.client(for: ethAddress)
        return try await client.conversations.findMessage(messageId: reference)
    }
}
