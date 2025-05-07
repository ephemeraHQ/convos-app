// ConvosNSE/Keychain.swift
// ... existing code ...
import Foundation
import Security // Import the Security framework for Keychain services
import os.log

func getKeychainQuery(key: String, requireAuthentication: Bool? = nil) -> [String : Any] {
  var service = getInfoPlistValue(key: "MainAppBundleIdentifier")
  if let requireAuthentication {
    service?.append(":\(requireAuthentication ? "auth" : "no-auth")")
  }

  log("Service for keychain query: \(service ?? "nil"), Key: \(key), RequireAuth: \(String(describing: requireAuthentication))", type: .debug, category: "keychainQuery")

  let encodedKey = Data(key.utf8)
  var query = [
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

  log("Keychain query constructed: \(query as NSDictionary)", type: .debug, category: "keychainQuery")
  return query
}

func _getKeychainValue(forKey: String, requireAuthentication: Bool? = nil) -> String? {
  var query = getKeychainQuery(key: forKey, requireAuthentication: requireAuthentication)
  query[kSecMatchLimit as String] = kSecMatchLimitOne
  query[kSecReturnData as String] = kCFBooleanTrue
  // If you're sharing keychain items, ensure kSecAttrAccessGroup is part of the query here as well.
  // It should be added in getKeychainQuery or directly here if not universally added there.
  // query[kSecAttrAccessGroup as String] = "YOUR_APP_IDENTIFIER_PREFIX.group.com.convos.preview" // Example

  log("Attempting to get keychain value for key: \(forKey), RequireAuth: \(String(describing: requireAuthentication))", type: .debug, category: "keychainRead")
  var item: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &item)
  
  log("SecItemCopyMatching status: \(status) for key: \(forKey)", type: .debug, category: "keychainRead")

  switch status {
  case errSecSuccess:
    guard let itemData = item as? Data else {
      log("Keychain item found for key: \(forKey), but failed to cast to Data.", type: .error, category: "keychainRead")
      return nil
    }
    log("Successfully retrieved and cast keychain item for key: \(forKey).", type: .debug, category: "keychainRead")
    return String(data: itemData, encoding: .utf8)
  case errSecItemNotFound:
    log("Keychain item not found for key: \(forKey). Status: errSecItemNotFound (\(status))", type: .debug, category: "keychainRead")
    return nil
  default:
    log("Failed to get keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)", type: .error, category: "keychainRead")
    return nil
  }
}

func getKeychainValue(forKey: String) -> String? {
  log("Getting keychain value for key: \(forKey) (trying unauthenticated, authenticated, legacy)", type: .debug, category: "keychainRead")
  if let unauthenticatedItem = _getKeychainValue(forKey: forKey, requireAuthentication: false) {
    log("Found unauthenticated keychain item for key: \(forKey)", type: .debug, category: "keychainRead")
    return unauthenticatedItem
  }
  if let authenticatedItem = _getKeychainValue(forKey: forKey, requireAuthentication: true) {
    log("Found authenticated keychain item for key: \(forKey)", type: .debug, category: "keychainRead")
    return authenticatedItem
  }
  if let legacyItem = _getKeychainValue(forKey: forKey) { // This calls _getKeychainValue with requireAuthentication = nil
    log("Found legacy (auth unspecified) keychain item for key: \(forKey)", type: .debug, category: "keychainRead")
    return legacyItem
  }
  log("No keychain item found for key: \(forKey) after trying all methods.", type: .debug, category: "keychainRead")
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

  log("Attempting to set keychain value for key: \(forKey). Query: \(query as NSDictionary)", type: .debug, category: "keychainWrite")

  let status = SecItemAdd(query as CFDictionary, nil)
  log("SecItemAdd status: \(status) for key: \(forKey)", type: .debug, category: "keychainWrite")

  switch status {
    case errSecSuccess:
      log("Successfully added keychain item for key: \(forKey)", type: .debug, category: "keychainWrite")
      return true
    case errSecDuplicateItem:
      log("Keychain item for key: \(forKey) already exists, attempting to update. Status: errSecDuplicateItem (\(status))", type: .debug, category: "keychainWrite")
      return try updateKeychainValue(value: value, forKey: forKey)
    default:
      log("Failed to add keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)", type: .error, category: "keychainWrite")
      return false
    }
}

func updateKeychainValue(value: String, forKey: String) throws -> Bool {
  let query = getKeychainQuery(key: forKey, requireAuthentication: false) // Assuming items are set without requiring auth for get
  // If you're sharing, ensure kSecAttrAccessGroup is part of the query here as well.
  // query[kSecAttrAccessGroup as String] = "YOUR_APP_IDENTIFIER_PREFIX.group.com.convos.preview" // Example

  let valueData = value.data(using: .utf8)
  let updateDictionary = [kSecValueData as String: valueData]

  log("Attempting to update keychain value for key: \(forKey). Query: \(query as NSDictionary), Updates: \(updateDictionary as NSDictionary)", type: .debug, category: "keychainWrite")

  let status = SecItemUpdate(query as CFDictionary, updateDictionary as CFDictionary)
  log("SecItemUpdate status: \(status) for key: \(forKey)", type: .debug, category: "keychainWrite")

  if status == errSecSuccess {
    log("Successfully updated keychain item for key: \(forKey)", type: .debug, category: "keychainWrite")
    return true
  } else {
    log("Failed to update keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)", type: .error, category: "keychainWrite")
    return false
  }
}
// ... existing code ...