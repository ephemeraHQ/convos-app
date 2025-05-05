import Foundation
import Security // Import the Security framework for Keychain services
import os.log

// Logger specifically for Keychain operations
private let keychainLogger = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "com.convos.nse.keychain", category: "Keychain")

/**
 Reads data associated with a specific key from the shared Keychain access group.
 Designed to read data stored by expo-secure-store or similar methods that use kSecClassGenericPassword.

 - Parameters:
    - key: The unique key identifying the Keychain item (e.g., "LIBXMTP_DB_ENCRYPTION_KEY_0x...")
    - group: The Keychain Access Group identifier (e.g., "group.com.yourcompany.yourapp") shared between the app and extension.
 - Returns: The raw Data associated with the key, or nil if not found or an error occurs.
 */
func readDataFromKeychain(key: String, group: String) -> Data? {
    os_log("Attempting to read Keychain item: Key=%{private}@, Group=%{public}@", log: keychainLogger, type: .debug, key, group)

    // Base query to search for a generic password item
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword, // Item type
        kSecAttrAccount as String: key,                // Unique key for the item (maps to expo-secure-store's key)
        kSecAttrAccessGroup as String: group,          // *** CRUCIAL: Specify the shared access group ***
        kSecMatchLimit as String: kSecMatchLimitOne,   // We only expect one item
        kSecReturnData as String: kCFBooleanTrue!      // Request the actual data to be returned
        // kSecAttrService might be needed if RN app explicitly sets it (often defaults to BundleID)
        // kSecAttrService as String: Bundle.main.bundleIdentifier ?? "com.convos.app.service" // Example if needed
    ]

    var item: CFTypeRef? // Variable to hold the retrieved data reference
    let status = SecItemCopyMatching(query as CFDictionary, &item) // Perform the search

    switch status {
    case errSecSuccess:
        // Successfully found the item and retrieved data
        guard let data = item as? Data else {
            os_log("Keychain read successful for key %{private}@, but failed to cast result to Data.", log: keychainLogger, type: .error, key)
            return nil
        }
        os_log("Keychain read successful for key %{private}@, data length: %d", log: keychainLogger, type: .debug, key, data.count)
        return data
    case errSecItemNotFound:
        // Item simply wasn't found - not necessarily an error in many cases
        os_log("Keychain item not found for key %{private}@", log: keychainLogger, type: .info, key)
        return nil
    default:
        // Any other status indicates a problem (permissions, configuration, etc.)
        os_log("Keychain read failed for key %{private}@ with unexpected status: %d", log: keychainLogger, type: .error, key, status)
        return nil
    }
}

// NOTE: This file currently only implements READING. 