import Foundation
import XMTP

fileprivate enum KeychainConstants {
  static func appGroupIdentifier(for environment: XMTP.XMTPEnvironment,
                                 withTeamId: Bool = false) -> String {
    let appGroupIdentifier: String
    if let appGroupIdentifierFromPlist = Bundle.getInfoPlistValue(
      for: "AppGroupIdentifier"
    ) {
      appGroupIdentifier = appGroupIdentifierFromPlist
    } else {
      SentryManager.shared.trackError(ErrorFactory.create(domain: "XmtpClient", description: "Failed getting app group ID from plist, using backup"))

      switch environment {
      case .dev:
        appGroupIdentifier = "group.com.convos.dev"
      case .local:
        appGroupIdentifier = "group.com.convos.preview"
      case .production:
        appGroupIdentifier = "group.com.convos.prod"
      }
    }
    let teamIdPrefix: String = "FY4NZR34Z3."
    return withTeamId ? teamIdPrefix + appGroupIdentifier : appGroupIdentifier
  }
}

extension XMTP.Client {
  enum ClientInitializationError: Error {
    case noEncryptionKey,
         appGroupContainerNotFound,
         failedInitializingMMKV
  }

  static func client(for ethAddress: String) async throws -> XMTP.Client {
    let xmtpEnv = XMTP.Client.xmtpEnvironment
    let groupId = KeychainConstants.appGroupIdentifier(for: xmtpEnv)
    let groupUrl = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: groupId)
    guard let groupUrl else {
      throw ClientInitializationError.appGroupContainerNotFound
    }

    /// For when we can use our Keychain Access group, waiting on upgrade to Expo SDK 53
//    guard let encryptionKeyString = KeychainWrapper.getValue(
//      forKey: ethAddress,
//      groupId: groupId
//    ),
//          let encryptionKey = Data(base64Encoded: encryptionKeyString) else {
//      throw ClientInitializationError.noEncryptionKey
//    }

    guard let mmkvHelper = MMKVHelper(appGroupDirectoryURL: groupUrl) else {
      throw ClientInitializationError.failedInitializingMMKV
    }
    guard let encryptionKeyString = mmkvHelper.getDatabaseKey(for: ethAddress),
          let encryptionKey = Data(base64Encoded: encryptionKeyString) else {
      throw ClientInitializationError.noEncryptionKey
    }

    let groupDir = groupUrl.path

    let options = ClientOptions(
      api: .init(env: xmtpEnv),
      dbEncryptionKey: encryptionKey,
      dbDirectory: groupDir
    )
    let identity = PublicIdentity(kind: .ethereum, identifier: ethAddress)
    let client = try await Client.build(publicIdentity: identity, options: options)
    Client.register(codec: ReplyCodec())
    Client.register(codec: ReactionCodec())
    Client.register(codec: ReactionV2Codec())
    Client.register(codec: AttachmentCodec())
    Client.register(codec: RemoteAttachmentCodec())
    return client
  }

  static var xmtpEnvironment: XMTP.XMTPEnvironment {
    let env = Bundle.getEnv()

    let xmtpEnv: XMTP.XMTPEnvironment = switch env {
      case .development:
        .local
      case .preview:
        .dev
      case .production:
        .production
      default:
        .local
    }
    
    SentryManager.shared.addBreadcrumb("Using XMTP Environment: \(xmtpEnv.rawValue)")
    return xmtpEnv
  }

}
