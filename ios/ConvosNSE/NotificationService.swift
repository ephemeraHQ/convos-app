import UserNotifications
import os.log
import Foundation
import XMTP // Import the XMTP SDK

final class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt:   UNMutableNotificationContent?
  private let logger = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "com.convos.nse", category: "NotificationService")

  // --- Dynamically read App Group ID ---
  private lazy var appGroupId: String? = {
      guard let groupId = getInfoPlistValue(key: "AppGroupIdentifier") else {
          os_log("FATAL ERROR: AppGroupIdentifier not found in NSE Info.plist!", log: logger, type: .fault)
          return nil
      }
      os_log("Using App Group ID from Info.plist: %{public}@", log: logger, type: .info, groupId) // Kept as .info
      return groupId
  }()


  // IMPORTANT: Must match the key used by the config plugin
  private let infoPlistXmtpEnvKey = "XmtpEnvironment"
  // IMPORTANT: Must match the key used by RN app to store DB key via expo-secure-store
  private let keychainDbKeyPrefix = "LIBXMTP_DB_ENCRYPTION_KEY_"
  // --- End Constants ---

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {

    print("Starting notification processing...")
    print("Request identifier:", request.identifier)
    print("Content title:", request.content.title)
    print("Content subtitle:", request.content.subtitle) 
    print("Content body:", request.content.body)

    // --- LOG THE ENTIRE INCOMING REQUEST CONTENT ---
    os_log("didReceive called for request ID: %{public}@", log: logger, type: .info, request.identifier) // Changed to .info
    os_log("Full UNNotificationRequest content:\n%{public}@", log: logger, type: .info, request.content.description) // Changed to .info
    // os_log("userInfo directly from content:\n%{public}@", log: logger, type: .info, request.content.userInfo.description) // Changed to .info if uncommented
    // --- END LOGGING ---

    // Ensure appGroupId was loaded successfully
    guard appGroupId != nil else {
       os_log("Cannot proceed without a valid App Group ID.", log: logger, type: .error)
       // Fallback or handle error appropriately - maybe show generic notification
       let mutableContent = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
       mutableContent.title = "Notification Error"
       mutableContent.body = "[Configuration Issue]"
       contentHandler(mutableContent)
       return
    }

    self.contentHandler = contentHandler
    self.bestAttempt    = (request.content.mutableCopy() as? UNMutableNotificationContent)

    // Perform potentially long-running tasks asynchronously
    Task {
      await handleNotificationAsync(request: request)
    }
  }

  // Main asynchronous processing logic
  private func handleNotificationAsync(request: UNNotificationRequest) async {
     // Ensure appGroupId is valid within the async task as well
     guard let currentAppGroupId = appGroupId else {
         os_log("App Group ID not available in async handler.", log: logger, type: .error)
         contentHandler?(request.content) // Or provide error content
         return
     }

    guard let currentBestAttempt = bestAttempt else {
      os_log("Failed to get mutable copy", log: logger, type: .error); contentHandler?(request.content); return
    }
    guard
      let userInfo = request.content.userInfo as? [String: Any] // Extract userInfo
    else {
      os_log("Could not extract userInfo dictionary from notification content", log: logger, type: .error); contentHandler?(request.content); return
    }

    // --- ADD LOGGING FOR userInfo ---
    os_log("Received notification userInfo:", log: logger, type: .info) // Changed to .info
    // Attempt to serialize userInfo to JSON string for clearer logging
    if let jsonData = try? JSONSerialization.data(withJSONObject: userInfo, options: [.prettyPrinted]),
       let jsonString = String(data: jsonData, encoding: .utf8) {
      // Use %{public}@ for debugging, switch to %{private}@ if sensitive data is logged long-term
      os_log("\n%{public}@", log: logger, type: .info, jsonString) // Changed to .info
    } else {
      // Fallback if JSON serialization fails (e.g., non-JSON compatible types)
      os_log("Could not serialize userInfo to JSON. Raw content: %{public}@", log: logger, type: .default, userInfo.description)
    }
    // --- END LOGGING ---

    // --- Continue extracting specific fields ---
    guard
        let bodyDict = userInfo["body"] as? [String: Any], // Get the nested body dictionary
        let encryptedMessage = bodyDict["encryptedMessage"] as? String, // Look inside bodyDict
        let topic = bodyDict["contentTopic"] as? String // Look inside bodyDict
        // Note: ethAddress is still missing from the payload, 
        // you might need it later for client building or keychain access.
        // Decide how to handle its absence. Maybe it's optional?
        // If required, the server MUST send it.
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

    // --- Temporarily hardcode ethAddress for testing ---
    // IMPORTANT: Commented out the guard that extracts from payload
    /*
    guard let ethAddress = userInfo["ethAddress"] as? String else { // Or maybe bodyDict["ethAddress"] if it should be nested too?
        os_log("Missing required 'ethAddress' field in userInfo dictionary.", log: logger, type: .error)
        contentHandler?(request.content); return
    }
    */
    // Use a hardcoded address for now
    let hardcodedEthAddress = "0x4cD8567E988057BE7e020b085BaB179AB6eB410f"
    // Lowercase the address before using it for the key
    let ethAddress = hardcodedEthAddress.lowercased() 
    os_log("!!! USING HARDCODED ethAddress (lowercased): %{private}@", log: logger, type: .info, ethAddress)
    // --- End temporary hardcoding ---

    os_log("Processing message - Topic: %{public}@, EthAddress: %{private}@", log: logger, type: .info, topic, ethAddress) // This will log the lowercased one now

    // --- 2. Retrieve Configuration & Keys ---
    guard let xmtpEnvString = getInfoPlistValue(key: infoPlistXmtpEnvKey) else {
      os_log("Failed to read XMTP environment from Info.plist", log: logger, type: .error)
      contentHandler?(request.content); return
    }
    let xmtpEnv = getXmtpEnvironmentFromString(envString: xmtpEnvString)

    // Construct key using the lowercased address
    let keychainDbKey = keychainDbKeyPrefix + ethAddress 
    guard let dbEncryptionKeyData = readDataFromKeychain(key: keychainDbKey, group: currentAppGroupId) else {
      os_log("Failed to read DB encryption key from shared Keychain using group %{public}@", log: logger, type: .error, currentAppGroupId)
      contentHandler?(request.content); return
    }
    guard dbEncryptionKeyData.count == 32 else {
      os_log("DB encryption key read from Keychain has incorrect length: %d bytes", log: logger, type: .error, dbEncryptionKeyData.count)
      contentHandler?(request.content); return
    }
    os_log("Successfully retrieved DB encryption key", log: logger, type: .info) // Changed to .info

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
      dbEncryptionKey: dbEncryptionKeyData,
      dbDirectory: groupDir
    )

    let identity = PublicIdentity(kind: .ethereum, identifier: ethAddress)

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

  // --- Keychain Reading Function (ensure it's present or add it) ---
  // NOTE: This assumes a similar Keychain reading function exists.
  // Make sure it accepts the group parameter.
  // If Keychain.swift contains this, ensure it's correctly linked/compiled.
   private func readDataFromKeychain(key: String, group: String) -> Data? {
       let query: [String: Any] = [
           kSecClass as String: kSecClassGenericPassword,
           kSecAttrAccount as String: key,
           kSecAttrService as String: Bundle.main.bundleIdentifier ?? "unknown-service", // Or a fixed service name
           kSecAttrAccessGroup as String: group, // Use the passed group ID
           kSecMatchLimit as String: kSecMatchLimitOne,
           kSecReturnData as String: kCFBooleanTrue!
       ]

       var item: CFTypeRef?
       let status = SecItemCopyMatching(query as CFDictionary, &item)

       guard status == errSecSuccess else {
           os_log("Keychain read failed for key '%{public}@' in group '%{public}@' with status %d", log: logger, type: .error, key, group, status)
           return nil
       }
       guard let data = item as? Data else {
            os_log("Keychain item found for key '%{public}@' in group '%{public}@' but was not Data", log: logger, type: .error, key, group)
           return nil
       }
       os_log("Successfully read data from keychain for key '%{public}@' in group '%{public}@'", log: logger, type: .info, key, group) // Changed to .info
       return data
   }
  // -----------------------------------------------------------------

}
