import UserNotifications
import os.log
import Foundation
import XMTP // Import the XMTP SDK

final class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt:   UNMutableNotificationContent?
  private let logger = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "com.convos.nse", category: "NotificationService")

  // --- Constants ---
  // IMPORTANT: Must match the group ID used in the main app and entitlements
  private let appGroupId = "group.convos.shared" // Make sure this exactly matches your App Group ID
  // IMPORTANT: Must match the key used by the config plugin
  private let infoPlistXmtpEnvKey = "XmtpEnvironment"
  // IMPORTANT: Must match the key used by RN app to store DB key via expo-secure-store
  private let keychainDbKeyPrefix = "LIBXMTP_DB_ENCRYPTION_KEY_"
  // --- End Constants ---

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    os_log("didReceive called with request ID: %{public}@", log: logger, type: .debug, request.identifier)
    
    self.contentHandler = contentHandler
    self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

    // Perform potentially long-running tasks asynchronously
    Task {
      await handleNotificationAsync(request: request)
    }
  }

  // Main asynchronous processing logic
  private func handleNotificationAsync(request: UNNotificationRequest) async {
    guard let currentBestAttempt = bestAttempt else {
      os_log("Failed to get mutable copy", log: logger, type: .error); contentHandler?(request.content); return
    }
    guard
      let userInfo = request.content.userInfo as? [String: Any] // Extract userInfo
    else {
      os_log("Could not extract userInfo dictionary from notification content", log: logger, type: .error); contentHandler?(request.content); return
    }

    // --- ADD LOGGING FOR userInfo ---
    os_log("Received notification userInfo:", log: logger, type: .debug)
    // Attempt to serialize userInfo to JSON string for clearer logging
    if let jsonData = try? JSONSerialization.data(withJSONObject: userInfo, options: [.prettyPrinted]),
       let jsonString = String(data: jsonData, encoding: .utf8) {
      // Use %{public}@ for debugging, switch to %{private}@ if sensitive data is logged long-term
      os_log("\n%{public}@", log: logger, type: .debug, jsonString)
    } else {
      // Fallback if JSON serialization fails (e.g., non-JSON compatible types)
      os_log("Could not serialize userInfo to JSON. Raw content: %{public}@", log: logger, type: .warning, userInfo.description)
    }
    // --- END LOGGING ---

    // --- Continue extracting specific fields ---
    guard
      let encryptedMessage = userInfo["encryptedMessage"] as? String,
      let topic = userInfo["contentTopic"] as? String,
      let ethAddress = userInfo["ethAddress"] as? String
    else {
      os_log("Missing required fields in userInfo dictionary after logging.", log: logger, type: .error)
      contentHandler?(request.content); return
    }
    os_log("Processing message - Topic: %{public}@, EthAddress: %{private}@", log: logger, type: .debug, topic, ethAddress)

    // --- 2. Retrieve Configuration & Keys ---
    guard let xmtpEnvString = getInfoPlistValue(key: infoPlistXmtpEnvKey) else {
      os_log("Failed to read XMTP environment from Info.plist", log: logger, type: .error)
      contentHandler?(request.content); return
    }
    let xmtpEnv = getXmtpEnvironmentFromString(envString: xmtpEnvString)

    let keychainDbKey = keychainDbKeyPrefix + ethAddress // Ensure ethAddress is lowercase if needed
    guard let dbEncryptionKeyData = readDataFromKeychain(key: keychainDbKey, group: appGroupId) else {
      os_log("Failed to read DB encryption key from shared Keychain", log: logger, type: .error)
      contentHandler?(request.content); return
    }
    guard dbEncryptionKeyData.count == 32 else {
      os_log("DB encryption key read from Keychain has incorrect length: %d bytes", log: logger, type: .error, dbEncryptionKeyData.count)
      contentHandler?(request.content); return
    }
    os_log("Successfully retrieved DB encryption key", log: logger, type: .debug)

    guard let messageBytes = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
      os_log("Failed to decode base64 encryptedMessage payload", log: logger, type: .error)
      contentHandler?(request.content); return
    }

    // --- 3. Build XMTP Client ---
    // Use shared App Group directory for the database
    guard let groupDir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?.path else {
      os_log("Failed to get App Group container URL", log: logger, type: .error)
      contentHandler?(request.content); return
    }

    let options = ClientOptions(
      api: .init(env: xmtpEnv, isSecure: true), // Assuming isSecure=true for dev/prod
      dbEncryptionKey: dbEncryptionKeyData,
      dbDirectory: groupDir,
      appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
    )
    os_log("Building XMTP client for address: %{private}@", log: logger, type: .debug, ethAddress)

    do {
      // Note: Building the client might be resource-intensive for an NSE. Monitor performance.
      let client = try await Client.build(address: ethAddress, options: options)
      os_log("XMTP client built successfully", log: logger, type: .debug)

      // Register necessary codecs (if needed for decryption/processing - check SDK requirements)
      // client.register(codec: TextCodec()) // Example - TextCodec is usually built-in

      // --- 4. Decrypt Message ---
      os_log("Attempting to find conversation by topic: %{public}@", log: logger, type: .debug, topic)
      guard let conversation = try? await client.findConversationByTopic(topic: topic) else {
        os_log("Conversation not found for topic: %{public}@", log: logger, type: .warning, topic)
        // Handle case where conversation isn't found - maybe it's new?
        // For now, show generic notification
        currentBestAttempt.title = "New Message"
        currentBestAttempt.body = "[Encrypted]"
        contentHandler?(currentBestAttempt); return
      }
      os_log("Conversation found. Syncing...", log: logger, type: .debug)
      try? await conversation.sync() // Best effort sync

      os_log("Processing message bytes...", log: logger, type: .debug)
      guard let message = try? await conversation.processMessage(messageBytes: messageBytes) else {
        os_log("Failed to process message bytes for topic: %{public}@", log: logger, type: .error, topic)
        currentBestAttempt.title = "New Message"
        currentBestAttempt.body = "[Decryption Error]"
        contentHandler?(currentBestAttempt); return
      }

      os_log("Decoding message content...", log: logger, type: .debug)
      guard let decodedMessage: DecodedMessage = try? message.decode() else {
        os_log("Failed to decode message content for topic: %{public}@", log: logger, type: .error, topic)
        currentBestAttempt.title = "New Message"
        currentBestAttempt.body = "[Decoding Error]"
        contentHandler?(currentBestAttempt); return
      }

      // --- 5. Update Notification Content ---
      var plaintext = "[Encrypted Content]" // Default
      // Basic handling for text content type
      if decodedMessage.encodedContent.type == ContentTypeText { // Check against standard text content type ID
        if let textContent = try? decodedMessage.content() as? String {
          plaintext = textContent
          os_log("Successfully decrypted text message", log: logger, type: .debug)
        } else {
          os_log("Content type was text, but failed to decode as String", log: logger, type: .warning)
        }
      } else {
        // Handle other content types (attachments, reactions etc.) later if needed
        let contentType = "\(decodedMessage.encodedContent.type.authorityID)/\(decodedMessage.encodedContent.type.typeID):\(decodedMessage.encodedContent.type.versionMajor).\(decodedMessage.encodedContent.type.versionMinor)"
        os_log("Received non-text message type: %{public}@", log: logger, type: .info, contentType)
        plaintext = "[Unsupported Content Type]" // Or a better description
      }

      // TODO: Enhance title generation - e.g., fetch sender display name if possible?
      currentBestAttempt.title = "New Message" // Simplified title for now
      currentBestAttempt.body = plaintext

      os_log("Delivering decrypted notification.", log: logger, type: .debug)
      contentHandler?(currentBestAttempt)

    } catch {
      os_log("Error during XMTP client build or message processing: %{public}@", log: logger, type: .error, error.localizedDescription)
      // Fallback: Show generic encrypted notification on error
      currentBestAttempt.title = "New Message"
      currentBestAttempt.body = "[Error Processing]"
      contentHandler?(currentBestAttempt)
    }
  }

  override func serviceExtensionTimeWillExpire() {
    os_log("serviceExtensionTimeWillExpire called", log: logger, type: .info)
    if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
      contentHandler(bestAttempt)
    }
  }

  // --- Helper Functions ---

  // Converts environment string from Info.plist to XMTP SDK Enum
  private func getXmtpEnvironmentFromString(envString: String) -> XMTPEnvironment {
    switch envString.lowercased() {
    case "production":
      return .production
    case "local":
      return .local // Assuming local mapping if needed
    case "dev":
      fallthrough // Fall through dev to default
    default:
      return .dev
    }
  }
}