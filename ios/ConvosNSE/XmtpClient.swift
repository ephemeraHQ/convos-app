import Foundation
import XMTP

enum KeychainConstants {
  static func appGroupIdentifier(for environment: XMTP.XMTPEnvironment,
                                 withTeamId: Bool = false) -> String {
    let appGroupIdentifier: String
    switch environment {
    case .dev, .local:
      appGroupIdentifier = "group.com.convos.preview"
    case .production:
      appGroupIdentifier = "group.com.convos.prod"
    }
    let teamIdPrefix: String = "FY4NZR34Z3."
    return withTeamId ? teamIdPrefix + appGroupIdentifier : appGroupIdentifier
  }
}

extension Bundle {
  static func getInfoPlistValue(for key: String) -> String? {
    guard let value = main.infoDictionary?[key] as? String else {
      log.error("Failed to find or cast Info.plist value for key: \(key)")
      return nil
    }

    return value
  }

  static func mainAppBundleId(for environment: XMTP.XMTPEnvironment) -> String {
    guard let bundleId = Bundle.getInfoPlistValue(for: "MainAppBundleIdentifier") else {
      log.debug("Failed getting main app bundle ID")

      switch environment {
      case .dev, .local:
        return "com.convos.preview"
      case .production:
        return "com.convos.prod"
      }
    }
    return bundleId
  }
}

extension XMTP.Client {
  enum ClientInitializationError: Error {
    case noEncryptionKey,
         appGroupContainerNotFound,
         failedInitializingMMKV
  }

  static func client(for ethAddress: String) async throws -> XMTP.Client {
    let xmtpEnv = getXmtpEnv()
    let groupId = KeychainConstants.appGroupIdentifier(for: xmtpEnv)

    /// For when we can use our Keychain Access group, waiting on upgrade to Expo SDK 53
//    guard let encryptionKeyString = KeychainWrapper.getValue(
//      forKey: ethAddress,
//      groupId: groupId
//    ),
//          let encryptionKey = Data(base64Encoded: encryptionKeyString) else {
//      throw ClientInitializationError.noEncryptionKey
//    }

    guard let mmkvHelper = MMKVHelper(environment: xmtpEnv) else {
      throw ClientInitializationError.failedInitializingMMKV
    }
    guard let encryptionKeyString = mmkvHelper.getDatabaseKey(for: ethAddress),
          let encryptionKey = Data(base64Encoded: encryptionKeyString) else {
      throw ClientInitializationError.noEncryptionKey
    }

    let groupUrl = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: groupId)
    guard let groupUrl else {
      throw ClientInitializationError.appGroupContainerNotFound
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

  private static func getXmtpEnv() -> XMTP.XMTPEnvironment {
    let env = Bundle.getInfoPlistValue(for: "XmtpEnvironment")

    if env == "production" {
      return .production
    }

    if env == "dev" {
      return .dev
    }

    return .local
  }

}
