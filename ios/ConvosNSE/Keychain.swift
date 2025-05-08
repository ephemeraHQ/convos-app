import Foundation
import Security
import os.log

func getKeychainQuery(key: String, requireAuthentication: Bool? = nil) -> [String : Any] {
    var service = getInfoPlistValue(key: "MainAppBundleIdentifier")
    if let requireAuthentication {
        service.append(":\(requireAuthentication ? "auth" : "no-auth")")
        log.debug("Keychain service modified for authentication requirement: \(service)")
    }

    log.debug(
        "Service for keychain query: \(service), Key: \(key), RequireAuth: \(String(describing: requireAuthentication))"
    )

    let encodedKey = Data(key.utf8)
    let query = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrGeneric as String: encodedKey,
        kSecAttrAccount as String: encodedKey,
    ] as [String : Any]

    // IMPORTANT: For shared keychain items, you MUST specify kSecAttrAccessGroup
    // This should be the shared keychain group, e.g., "YOUR_TEAM_ID.group.com.convos.preview"
    // The actual AppIdentifierPrefix (Team ID) will be prepended by the system if you use "$(AppIdentifierPrefix)" in entitlements.
    // For direct keychain API calls, you usually need the full string including the Team ID.
    // Let's assume you have a helper to get this full group ID or you'll hardcode it for now.
    // query[kSecAttrAccessGroup as String] = "YOUR_APP_IDENTIFIER_PREFIX.group.com.convos.preview" // Replace with your actual group ID
    // For now, I will comment this out as your NotificationService.swift might be handling the group ID differently.
    // If readDataFromKeychain in NotificationService.swift already adds this, it's fine.

    log.debug("Keychain query constructed: \(query)")
    return query
}

func _getKeychainValue(forKey: String, requireAuthentication: Bool? = nil) -> String? {
    var query = getKeychainQuery(key: forKey, requireAuthentication: requireAuthentication)
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    query[kSecReturnData as String] = kCFBooleanTrue
    // If you're sharing keychain items, ensure kSecAttrAccessGroup is part of the query here as well.
    // It should be added in getKeychainQuery or directly here if not universally added there.
    // query[kSecAttrAccessGroup as String] = "YOUR_APP_IDENTIFIER_PREFIX.group.com.convos.preview" // Example

    log.debug("Attempting to get keychain value for key: \(forKey), RequireAuth: \(String(describing: requireAuthentication))")
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    log.debug("SecItemCopyMatching status: \(status) for key: \(forKey)")

    switch status {
    case errSecSuccess:
        guard let itemData = item as? Data else {
            log.error("Keychain item found for key: \(forKey), but failed to cast to Data.")
            return nil
        }
        log.debug("Successfully retrieved and cast keychain item for key: \(forKey).")
        return String(data: itemData, encoding: .utf8)
    case errSecItemNotFound:
        log.error("Keychain item not found for key: \(forKey). Status: errSecItemNotFound (\(status))")
        return nil
    default:
        log.error("Failed to get keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)")
        return nil
    }
}

func getKeychainValue(forKey: String) -> String? {
    log.debug("Getting keychain value for key: \(forKey) (trying unauthenticated, authenticated, legacy)")
    if let unauthenticatedItem = _getKeychainValue(forKey: forKey, requireAuthentication: false) {
        log.debug("Found unauthenticated keychain item for key: \(forKey)")
        return unauthenticatedItem
    }
    if let authenticatedItem = _getKeychainValue(forKey: forKey, requireAuthentication: true) {
        log.debug("Found authenticated keychain item for key: \(forKey)")
        return authenticatedItem
    }
    if let legacyItem = _getKeychainValue(forKey: forKey) { // This calls _getKeychainValue with requireAuthentication = nil
        log.debug("Found legacy (auth unspecified) keychain item for key: \(forKey)")
        return legacyItem
    }
    log.error("No keychain item found for key: \(forKey) after trying all methods.")
    return nil
}

func setKeychainValue(value: String, forKey: String) throws -> Bool {
    var query = getKeychainQuery(key: forKey, requireAuthentication: false) // Assuming items are set without requiring auth for get
    // If you're sharing, ensure kSecAttrAccessGroup is part of the query here as well.
    // query[kSecAttrAccessGroup as String] = "YOUR_APP_IDENTIFIER_PREFIX.group.com.convos.preview" // Example

    let valueData = value.data(using: .utf8)
    query[kSecValueData as String] = valueData
    let accessibility = kSecAttrAccessibleAfterFirstUnlock // Consider kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly if not syncing to iCloud
    query[kSecAttrAccessible as String] = accessibility

    log.debug("Attempting to set keychain value for key: \(forKey). Query: \(query as NSDictionary)")

    let status = SecItemAdd(query as CFDictionary, nil)
    log.debug("SecItemAdd status: \(status) for key: \(forKey)")

    switch status {
    case errSecSuccess:
        log.debug("Successfully added keychain item for key: \(forKey)")
        return true
    case errSecDuplicateItem:
        log.error("Keychain item for key: \(forKey) already exists, attempting to update. Status: errSecDuplicateItem (\(status))")
        return try updateKeychainValue(value: value, forKey: forKey)
    default:
        log.error("Failed to add keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)")
        return false
    }
}

func updateKeychainValue(value: String, forKey: String) throws -> Bool {
    let query = getKeychainQuery(key: forKey, requireAuthentication: false) // Assuming items are set without requiring auth for get
    // If you're sharing, ensure kSecAttrAccessGroup is part of the query here as well.
    // query[kSecAttrAccessGroup as String] = "YOUR_APP_IDENTIFIER_PREFIX.group.com.convos.preview" // Example

    let valueData = value.data(using: .utf8)
    let updateDictionary = [kSecValueData as String: valueData]

    log.debug("Attempting to update keychain value for key: \(forKey). Query: \(query as NSDictionary), Updates: \(updateDictionary as NSDictionary)")

    let status = SecItemUpdate(query as CFDictionary, updateDictionary as CFDictionary)
    log.debug("SecItemUpdate status: \(status) for key: \(forKey)")

    if status == errSecSuccess {
        log.debug("Successfully updated keychain item for key: \(forKey)")
        return true
    } else {
        log.error("Failed to update keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)")
        return false
    }
}
