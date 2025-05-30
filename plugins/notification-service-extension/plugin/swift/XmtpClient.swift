import Foundation
import XMTP

extension XMTP.Client {
  private static var clientCache: [String: XMTP.Client] = [:]
  private static let cacheQueue = DispatchQueue(label: "com.xmtp.client.cacheQueue", attributes: .concurrent)
  
  // Storage prefixes - NEVER CHANGE THESE! They must match the React Native app
  private static let mmkvKeyPrefix = "BACKUP_XMTP_KEY_"
  private static let keychainKeyPrefix = "KEYCHAIN_XMTP_DB_ENCRYPTION_KEY_"
  private static let fileKeyPrefix = "FILE_BACKUP_XMTP_DB_ENCRYPTION_KEY_"

  enum ClientInitializationError: Error {
    case noEncryptionKey,
         appGroupContainerNotFound,
         failedInitializingMMKV
  }
  
  private static func getDatabaseKey(for ethereumAddress: String) -> String? {
    // 1. Try MMKV first (current implementation)
    if let mmkvKey = MMKVHelper.shared.getString(forKey: mmkvKeyPrefix + ethereumAddress) {
      SentryManager.shared.addBreadcrumb("Retrieved encryption key from MMKV for \(ethereumAddress)")
      return mmkvKey
    }
    
    // 2. Try file-based storage in App Group container
    let fileName = "\(fileKeyPrefix)\(ethereumAddress).key"
    if let fileKey = AppGroupFileManager.shared.readFile(fileName: fileName) {
      SentryManager.shared.addBreadcrumb("Retrieved encryption key from file backup for \(ethereumAddress)")
      return fileKey
    }
    
    // 3. Try Keychain as last resort until we move to Expo SDK 53
    if let keychainKey = KeychainWrapper.getValue(forKey: ethereumAddress) {
      SentryManager.shared.addBreadcrumb("Retrieved encryption key from Keychain for \(ethereumAddress)")
      return keychainKey
    }
    
    SentryManager.shared.trackError(ErrorFactory.create(
      domain: "XmtpClient",
      description: "Failed to retrieve encryption key from all storage methods for \(ethereumAddress)"
    ))
    return nil
  }

  static func client(for ethAddress: String) async throws -> XMTP.Client {
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

    // Try to get the encryption key from MMKV storage using the ethereum address
    let encryptionKeyString = Self.getDatabaseKey(for: ethAddress)
    guard let encryptionKeyString else {
      throw ClientInitializationError.noEncryptionKey
    }
    
    let encryptionKey = Data(base64Encoded: encryptionKeyString)
    guard let encryptionKey else {
      throw ClientInitializationError.noEncryptionKey
    }

    let groupDir = groupUrl.path

    SentryManager.shared.addBreadcrumb("Creating XMTP client", extras: [
      "xmtpEnv": xmtpEnv.rawValue,
      "groupId": groupId,
      "groupUrl": groupUrl.path,
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
