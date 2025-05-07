import UserNotifications
import os.log
import Foundation
import XMTP

final class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt:   UNMutableNotificationContent?
  private let logger = OSLog(subsystem: "com.convos.nse", category: "NotificationService")

  // IMPORTANT: Must match the key used by the config plugin
  private let infoPlistXmtpEnvKey = "XmtpEnvironment"
  // IMPORTANT: Must match the key used by RN app to store DB key via expo-secure-store
  private let keychainDbKeyPrefix = "LIBXMTP_DB_ENCRYPTION_KEY_"
  // IMPORTANT: Must match the key used by RN app to store DB key via SharedDefaults
  private let sharedDefaultsKey = "SHARED_DEFAULTS_XMTP_KEY_"
  // IMPORTANT: Must match the key used by RN app to store DB key via MMKV
  private let mmkvKey = "BACKUP_XMTP_KEY_"

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    os_log("didReceive called for request ID: %{public}@", log: logger, type: .info, request.identifier) // Changed to .info
    os_log("Full UNNotificationRequest content:\n%{public}@", log: logger, type: .info, request.content.description) // Changed to .info
    
    self.contentHandler = contentHandler
    self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

    Task {
      await handleNotificationAsync(request: request)
    }
  }

  // Main asynchronous processing logic
  private func handleNotificationAsync(request: UNNotificationRequest) async {
     guard let currentAppGroupId = try? getInfoPlistValue(key: "AppGroupIdentifier") else {
         os_log("FATAL ERROR: AppGroupIdentifier not found in NSE Info.plist!", log: logger, type: .fault)
         contentHandler?(request.content)
         return
     }

     os_log("Using App Group ID from Info.plist: %{public}@", log: logger, type: .info, currentAppGroupId)
     
     var ethAddressToUse = ""
     if let bodyDict = request.content.userInfo["body"] as? [String: Any],
        let ethAddressFromNotif = bodyDict["ethAddress"] as? String {
         os_log("Found ethAddress in notification body: %{public}@", log: logger, type: .info, ethAddressFromNotif)
         ethAddressToUse = ethAddressFromNotif
     } else {
         os_log("No ethAddress found in notification body, using default", log: logger, type: .info)
         contentHandler?(request.content);
         return
     }
     let ethAddress = ethAddressToUse

     let dbEncryptionKeyString: String
     
     let keyFromKeychain = getKeychainValue(forKey: keychainDbKeyPrefix + ethAddress)
     if keyFromKeychain != nil {
         os_log("Successfully retrieved DB encryption key from keychain", log: logger, type: .debug)
         dbEncryptionKeyString = keyFromKeychain!
         return
     }
     
     let backupKey = getBackupKeyInMmkv(ethAddress: ethAddress)
     if backupKey != "" {
         os_log("Retrieved DB encryption key from MMKV backup", log: logger, type: .debug)
         dbEncryptionKeyString = backupKey
         return
     }
     
     let key = getSharedDefaultsValue(key: sharedDefaultsKey + ethAddress)
     if key != nil {
         os_log("Retrieved DB encryption key from SharedDefaults", log: logger, type: .debug)
         dbEncryptionKeyString = key!
         return
     }
     
     os_log("Failed to get DB encryption key from keychain, MMKV backup, and SharedDefaults", log: logger, type: .error)
     if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
         contentHandler(bestAttempt)
     } else {
         contentHandler?(request.content)
     }
     return

     // Attempt to decode the Base64 string into Data
     guard let dbEncryptionKeyData = Data(base64Encoded: dbEncryptionKeyString) else {
        os_log("!!! [EARLY CHECK] Failed to decode Base64 DB encryption key string. Original string: '%{public}@'", log: logger, type: .error, dbEncryptionKeyString)
        if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
            contentHandler(bestAttempt)
        } else {
            contentHandler?(request.content)
        }
        return
     }

     // Check the length of the decoded Data
     guard dbEncryptionKeyData.count == 32 else {
       os_log("!!! [EARLY CHECK] DB encryption key (decoded from string) has incorrect length: %d bytes. Expected 32. Original string length: %d", log: logger, type: .error, dbEncryptionKeyData.count, dbEncryptionKeyString.count)
        if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
           contentHandler(bestAttempt)
       } else {
           contentHandler?(request.content)
       }
       return
     }
     os_log("!!! [EARLY CHECK] Successfully retrieved and decoded DB encryption key. Data length: %d bytes.", log: logger, type: .info, dbEncryptionKeyData.count)
     // --- End Moved Keychain Check ---


    guard let currentBestAttempt = bestAttempt else {
      os_log("Failed to get mutable copy", log: logger, type: .error); contentHandler?(request.content); return
    }

    guard
      let userInfo = request.content.userInfo as? [String: Any] // Extract userInfo
    else {
      os_log("Could not extract userInfo dictionary from notification content", log: logger, type: .error); contentHandler?(request.content); return
    }

    os_log("Received notification userInfo:", log: logger, type: .info) // Changed to .info
    // Attempt to serialize userInfo to JSON string for clearer logging
    if let jsonData = try? JSONSerialization.data(withJSONObject: userInfo, options: [.prettyPrinted]),
       let jsonString = String(data: jsonData, encoding: .utf8) {
      // Use %{public}@ for debugging, switch to %{public}@ if sensitive data is logged long-term
      os_log("\n%{public}@", log: logger, type: .info, jsonString) // Changed to .info
    } else {
      // Fallback if JSON serialization fails (e.g., non-JSON compatible types)
      os_log("Could not serialize userInfo to JSON. Raw content: %{public}@", log: logger, type: .default, userInfo.description)
    }

    // --- Continue extracting specific fields ---
    guard
        let bodyDict = userInfo["body"] as? [String: Any], // Get the nested body dictionary
        let encryptedMessage = bodyDict["encryptedMessage"] as? String, // Look inside bodyDict
        let topic = bodyDict["contentTopic"] as? String, // Look inside bodyDict
        let ethAddress = bodyDict["ethAddress"] as? String // Look inside bodyDict
    else {
      // Add more specific logging if needed
      if userInfo["body"] == nil {
         os_log("Missing 'body' dictionary in userInfo.", log: logger, type: .error)
      } else if (userInfo["body"] as? [String: Any])?["encryptedMessage"] == nil {
         os_log("Missing 'encryptedMessage' key within 'body' dictionary.", log: logger, type: .error)
      } else if (userInfo["body"] as? [String: Any])?["contentTopic"] == nil {
          os_log("Missing 'contentTopic' key within 'body' dictionary.", log: logger, type: .error)
      } else {
           os_log("Missing required fields (possibly ethAddress?) or incorrect type in userInfo/body dictionary.", log: logger, type: .error)
      }

      contentHandler?(request.content); return
    }

    os_log("Processing message - Topic: %{public}@, EthAddress: %{public}@", log: logger, type: .info, topic, ethAddress) // This will log the lowercased one now

    // --- 2. Retrieve Configuration & Keys ---
    guard let xmtpEnvString = getInfoPlistValue(key: infoPlistXmtpEnvKey) else {
      os_log("Failed to read XMTP environment from Info.plist", log: logger, type: .error)
      contentHandler?(request.content); return
    }
    let xmtpEnv = getXmtpEnvironmentFromString(envString: xmtpEnvString)

    guard let messageBytes = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
      os_log("Failed to decode base64 encryptedMessage payload", log: logger, type: .error)
      contentHandler?(request.content); return
    }

    // --- 3. Build XMTP Client ---
    // Use shared App Group directory for the database - using the dynamic group ID
    guard let groupDir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: currentAppGroupId)?.path else {
      os_log("Failed to get App Group container URL for group %{public}@", log: logger, type: .error, currentAppGroupId)
      contentHandler?(request.content); return
    }

    let options = ClientOptions(
      api: .init(env: xmtpEnv, isSecure: true), // Assuming isSecure=true for dev/prod
      dbEncryptionKey: dbEncryptionKeyData, // Use the key data retrieved earlier
      dbDirectory: groupDir
    )

    let identity = PublicIdentity(kind: .ethereum, identifier: ethAddress) // Use address determined earlier

    do {
      // Note: Building the client might be resource-intensive for an NSE. Monitor performance.
      let client = try await Client.build(publicIdentity: identity, options: options)
      os_log("XMTP client built successfully for group %{public}@", log: logger, type: .info, currentAppGroupId) // Changed to .info


      // --- 4. Decrypt Message ---
      os_log("Attempting to find conversation by topic: %{public}@", log: logger, type: .info, topic) // Changed to .info

      guard let conversation = try? await client.conversations.findConversationByTopic(topic: topic) else {
        os_log("Conversation not found for topic: %{public}@", log: logger, type: .default, topic)
        currentBestAttempt.title = "New Message"
        currentBestAttempt.body = "[Encrypted]"
        contentHandler?(currentBestAttempt); return
      }
      os_log("Conversation found. Syncing...", log: logger, type: .info) // Changed to .info
      try? await conversation.sync()

      os_log("Processing message bytes...", log: logger, type: .info) // Changed to .info
      guard let decodedMessage = try? await conversation.processMessage(messageBytes: messageBytes) else {
        os_log("Failed to process message bytes for topic: %{public}@", log: logger, type: .error, topic)
        currentBestAttempt.title = "New Message"
        currentBestAttempt.body = "[Decryption Error]"
        contentHandler?(currentBestAttempt); return
      }

      // --- 5. Update Notification Content ---
      var plaintext = "[Encrypted Content]" // Default

      do {
        let currentEncodedContent = try decodedMessage.encodedContent
        if currentEncodedContent.type == ContentTypeText {
          if let textContent = try? decodedMessage.content() as String {
             plaintext = textContent
             os_log("Successfully decrypted text message", log: logger, type: .info) // Changed to .info
          } else {
            os_log("Content type was text, but failed to decode as String or content() threw an error.", log: logger, type: .default)
            if let fallbackText = try? decodedMessage.fallback {
                plaintext = fallbackText
                os_log("Used fallback content for text message.", log: logger, type: .info) // Changed to .info
            } else {
                os_log("Failed to get fallback content as well.", log: logger, type: .default)
                plaintext = "[Decryption/Format Error]"
            }
          }
        } else {
          let contentType = "\(currentEncodedContent.type.authorityID)/\(currentEncodedContent.type.typeID):\(currentEncodedContent.type.versionMajor).\(currentEncodedContent.type.versionMinor)"
          os_log("Received non-text message type: %{public}@", log: logger, type: .info) // Kept as .info
           if let fallbackText = try? decodedMessage.fallback {
               plaintext = fallbackText
               os_log("Used fallback content for non-text message.", log: logger, type: .info) // Changed to .info
           } else {
               os_log("Failed to get fallback content for non-text message.", log: logger, type: .default)
               plaintext = "[Unsupported Content Type]"
           }
        }
      } catch {
         os_log("Error accessing or decoding encodedContent: %{public}@", log: logger, type: .error, error.localizedDescription)
         plaintext = "[Error Reading Content]"
      }

      // Set both title and body to the decrypted plaintext for now
      os_log(">>> Decrypted Plaintext: '%{public}@'", log: logger, type: .info, plaintext) // Log with quotes to see if empty
      currentBestAttempt.title = plaintext
      currentBestAttempt.body = plaintext

      os_log("Delivering decrypted notification.", log: logger, type: .info)
      contentHandler?(currentBestAttempt)


    } catch {
      os_log("Error during XMTP client build or message processing: %{public}@", log: logger, type: .error, error.localizedDescription)
      currentBestAttempt.title = "New Message"
      currentBestAttempt.body = "[Error Processing]"
      contentHandler?(currentBestAttempt)
    }
  }

  override func serviceExtensionTimeWillExpire() {
    os_log("serviceExtensionTimeWillExpire called", log: logger, type: .info) // Kept as .info
    if let contentHandler = contentHandler, let bestAttempt = bestAttempt {
      contentHandler(bestAttempt)
    }
  }

  // Converts environment string from Info.plist to XMTP SDK Enum
  private func getXmtpEnvironmentFromString(envString: String) -> XMTPEnvironment {
    switch envString.lowercased() {
    case "production":
      return .production
    case "local":
      return .local
    case "dev":
      fallthrough
    default:
      return .dev
    }
  }
}
