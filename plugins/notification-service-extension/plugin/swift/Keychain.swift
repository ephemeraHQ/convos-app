import Foundation
import Security
import os.log

enum KeychainWrapper {
  func getQuery(key: String,
                groupId: String,
                requireAuthentication: Bool? = nil) -> [String: Any] {
    var service = Bundle.mainAppBundleId(for: .dev)

    if let requireAuthentication {
      service.append(":\(requireAuthentication ? "auth" : "no-auth")")
      log.debug("Keychain service modified for authentication requirement: \(service)")
    }

    log.debug(
      "Service for keychain query: \(service), Key: \(key), RequireAuth: \(String(describing: requireAuthentication))"
    )

    let encodedKey = Data(key.utf8)
    let query =
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrGeneric as String: encodedKey,
      kSecAttrAccount as String: encodedKey,
      kSecAttrAccessGroup as String: groupId
    ] as [String: Any]

    log.debug("Keychain query constructed: \(query)")
    return query
  }

  func _getValue(forKey: String,
                 groupId: String,
                 requireAuthentication: Bool? = nil) -> String? {
    var query = getQuery(key: forKey,
                         groupId: groupId,
                         requireAuthentication: requireAuthentication)
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    query[kSecReturnData as String] = kCFBooleanTrue

    log.debug(
      "Attempting to get keychain value for key: \(forKey), RequireAuth: \(String(describing: requireAuthentication))"
    )
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    log.debug("SecItemCopyMatching status: \(status) for key: \(forKey)")

    switch status {
    case errSecSuccess:
      guard let itemData = item as? Data else {
        SentryManager.shared.trackMessage("Keychain item found for key: \(forKey), but failed to cast to Data.")
        return nil
      }
      log.debug("Successfully retrieved and cast keychain item for key: \(forKey).")
      return String(data: itemData, encoding: .utf8)
    case errSecItemNotFound:
      SentryManager.shared.trackMessage(
        "Keychain item not found for key: \(forKey). Status: errSecItemNotFound (\(status))")
      return nil
    default:
      SentryManager.shared.trackMessage(
        "Failed to get keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)"
      )
      return nil
    }
  }

  func getValue(forKey: String, groupId: String) -> String? {
    log.debug(
      "Getting keychain value for key: \(forKey) (trying unauthenticated, authenticated, legacy)")
    if let unauthenticatedItem = _getValue(forKey: forKey,
                                           groupId: groupId,
                                           requireAuthentication: false) {
      log.debug("Found unauthenticated keychain item for key: \(forKey)")
      return unauthenticatedItem
    }
    if let authenticatedItem = _getValue(forKey: forKey,
                                         groupId: groupId,
                                         requireAuthentication: true) {
      log.debug("Found authenticated keychain item for key: \(forKey)")
      return authenticatedItem
    }
    if let legacyItem = _getValue(
      forKey: forKey,
      groupId: groupId
    ) {  // This calls _getKeychainValue with requireAuthentication = nil
      log.debug("Found legacy (auth unspecified) keychain item for key: \(forKey)")
      return legacyItem
    }
    SentryManager.shared.trackMessage("No keychain item found for key: \(forKey) after trying all methods.")
    return nil
  }
}
