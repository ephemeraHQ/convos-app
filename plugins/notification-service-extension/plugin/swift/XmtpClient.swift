import Foundation
import XMTP

extension XMTP.Client {
  private static var clientCache: [String: XMTP.Client] = [:]
  private static let cacheQueue = DispatchQueue(label: "com.xmtp.client.cacheQueue", attributes: .concurrent)
  private static let databaseKeyPrefix = "BACKUP_XMTP_KEY_"

  enum ClientInitializationError: Error {
    case noEncryptionKey,
         appGroupContainerNotFound,
         failedInitializingMMKV
  }

  private static func getDatabaseKey(for ethereumAddress: String) -> String? {
    return MMKVHelper.shared.getString(forKey: databaseKeyPrefix + ethereumAddress)
  }

  static func client(for ethAddress: String) async throws -> XMTP.Client {
    MMKVHelper.shared.testKeys()
    
    // Check cache first
    if let cachedClient = cacheQueue.sync(execute: { self.clientCache[ethAddress] }) {
      SentryManager.shared.addBreadcrumb("XMTP client cache hit for \(ethAddress)")
      return cachedClient
    }
    SentryManager.shared.addBreadcrumb("XMTP client cache miss for \(ethAddress), creating new client.")

    let xmtpEnv = XmtpHelpers.shared.getEnvironment()
    let groupId = Bundle.appGroupIdentifier()
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

    // Try to get the encryption key from MMKV storage using the ethereum address
    let encryptionKeyString = Self.getDatabaseKey(for: ethAddress)
    guard let encryptionKeyString else {
      throw ClientInitializationError.noEncryptionKey
    }
    
    let encryptionKey = Data(base64Encoded: encryptionKeyString)
    guard let encryptionKey else {
      throw ClientInitializationError.noEncryptionKey
    }

    SentryManager.shared.addBreadcrumb("Found encryption key: \(encryptionKeyString)")

    let groupDir = groupUrl.path

    SentryManager.shared.addBreadcrumb("Creating XMTP client", extras: [
      "xmtpEnv": xmtpEnv.rawValue,
      "groupId": groupId,
      "groupUrl": groupUrl.path,
      "encryptionKeyString": encryptionKeyString,
      "ethAddress": ethAddress
    ])

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

    // Store the newly created client in the cache
    cacheQueue.async(flags: .barrier) {
        self.clientCache[ethAddress] = client
    }

    return client
  }
}
