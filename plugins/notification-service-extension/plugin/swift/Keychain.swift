import Foundation
import Security
import os.log

enum KeychainWrapper {
  func getQuery(key: String,
                groupId: String,
                requireAuthentication: Bool? = nil) -> [String: Any] {
    var service = Bundle.mainAppBundleId()
    SentryManager.shared.addBreadcrumb("Initial service for keychain query: \(service)")

    if let requireAuthentication {
      service.append(":\(requireAuthentication ? "auth" : "no-auth")")
      SentryManager.shared.addBreadcrumb("Keychain service modified for authentication requirement: \(service)")
    }

    SentryManager.shared.addBreadcrumb(
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

    SentryManager.shared.addBreadcrumb("Keychain query constructed: \(query.description)")
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

    SentryManager.shared.addBreadcrumb(
      "Attempting to get keychain value for key: \(forKey), RequireAuth: \(String(describing: requireAuthentication))"
    )
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    SentryManager.shared.addBreadcrumb("SecItemCopyMatching status: \(status) for key: \(forKey)")

    switch status {
    case errSecSuccess:
      guard let itemData = item as? Data else {
        SentryManager.shared.trackError(ErrorFactory.create(domain: "KeychainWrapper", description: "Keychain item found for key: \(forKey), but failed to cast to Data."))
        return nil
      }
      SentryManager.shared.addBreadcrumb("Successfully retrieved and cast keychain item for key: \(forKey).")
      return String(data: itemData, encoding: .utf8)
    case errSecItemNotFound:
      SentryManager.shared.trackError(ErrorFactory.create(domain: "KeychainWrapper", description: "Keychain item not found for key: \(forKey). Status: errSecItemNotFound (\(status))"))
      return nil
    default:
      SentryManager.shared.trackError(ErrorFactory.create(domain: "KeychainWrapper", description: "Failed to get keychain item for key: \(forKey). Status: \(status), OSStatus: \(status.description)"))
      return nil
    }
  }

  func getValue(forKey: String, groupId: String) -> String? {
    SentryManager.shared.addBreadcrumb(
      "Getting keychain value for key: \(forKey) (trying unauthenticated, authenticated, legacy)"
    )
    if let unauthenticatedItem = _getValue(forKey: forKey,
                                           groupId: groupId,
                                           requireAuthentication: false) {
      SentryManager.shared.addBreadcrumb("Found unauthenticated keychain item for key: \(forKey)")
      return unauthenticatedItem
    }
    if let authenticatedItem = _getValue(forKey: forKey,
                                         groupId: groupId,
                                         requireAuthentication: true) {
      SentryManager.shared.addBreadcrumb("Found authenticated keychain item for key: \(forKey)")
      return authenticatedItem
    }
    if let legacyItem = _getValue(
      forKey: forKey,
      groupId: groupId
    ) {  // This calls _getKeychainValue with requireAuthentication = nil
      SentryManager.shared.addBreadcrumb("Found legacy (auth unspecified) keychain item for key: \(forKey)")
      return legacyItem
    }
    SentryManager.shared.trackError(ErrorFactory.create(domain: "KeychainWrapper", description: "No keychain item found for key: \(forKey) after trying all methods."))
    return nil
  }
}
