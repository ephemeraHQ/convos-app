import Foundation
import Security
import os.log

enum KeychainWrapper {
    static func getValue(forKey key: String) -> String? {
        let groupId = Bundle.appGroupIdentifier()
        
        let attempts = [
            ("unauthenticated", false),
            ("authenticated", true),
            ("legacy", nil)
        ]
        
        for (type, requireAuth) in attempts {
            if let value = getKeychainValue(forKey: key, 
                                          groupId: groupId,
                                          requireAuthentication: requireAuth) {
                SentryManager.shared.addBreadcrumb("Found \(type) keychain value for key: \(key)")
                return value
            }
        }
        
        SentryManager.shared.trackError(ErrorFactory.create(
            domain: "KeychainWrapper",
            description: "No keychain value found for key: \(key) after trying all auth methods"
        ))
        return nil
    }
    
    private static func getKeychainValue(forKey key: String,
                                       groupId: String, 
                                       requireAuthentication: Bool? = nil) -> String? {
        let query = buildKeychainQuery(key: key,
                                     groupId: groupId, 
                                     requireAuthentication: requireAuthentication)
        
        SentryManager.shared.addBreadcrumb("Attempting keychain lookup",
            extras: [
                "key": key,
                "requireAuth": String(describing: requireAuthentication)
            ]
        )
        
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        
        switch status {
        case errSecSuccess:
            guard let data = item as? Data,
                  let value = String(data: data, encoding: .utf8) else {
                SentryManager.shared.trackError(ErrorFactory.create(
                    domain: "KeychainWrapper",
                    description: "Failed to decode keychain data for key: \(key)"
                ))
                return nil
            }
            return value
            
        case errSecItemNotFound:
            SentryManager.shared.trackError(ErrorFactory.create(
                domain: "KeychainWrapper",
                description: "Item not found for key: \(key)"
            ))
            return nil
            
        default:
            SentryManager.shared.trackError(ErrorFactory.create(
                domain: "KeychainWrapper",
                description: "Keychain error \(status) for key: \(key)"
            ))
            return nil
        }
    }
    
    private static func buildKeychainQuery(key: String,
                                         groupId: String,
                                         requireAuthentication: Bool?) -> [String: Any] {
        var service = Bundle.mainAppBundleId()
        
        if let requireAuthentication {
            service.append(":\(requireAuthentication ? "auth" : "no-auth")")
        }
        
        let keyData = Data(key.utf8)
        
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrGeneric as String: keyData,
            kSecAttrAccount as String: keyData,
            kSecAttrAccessGroup as String: groupId,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: kCFBooleanTrue
        ]
        
        return query
    }
}
