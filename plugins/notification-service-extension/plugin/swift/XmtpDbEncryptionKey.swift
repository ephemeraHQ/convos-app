import Foundation

let keychainKeyPrefix = "LIBXMTP_DB_ENCRYPTION_KEY_"
let backupKeyPrefix = "BACKUP_XMTP_KEY_"
let sharedDefaultsKey = "SHARED_DEFAULTS_XMTP_KEY_"


func getDbEncryptionKey(ethAddress: String) -> Data? {
    var dbEncryptionKeyString: String?
    
    // Try keychain first
    if let keyFromKeychain = getKeychainValue(forKey: keychainKeyPrefix + ethAddress) {
        log("Successfully retrieved DB encryption key from keychain", type: .debug, category: "keychain")
        dbEncryptionKeyString = keyFromKeychain
    }
    
    // Try MMKV backup if keychain failed
    if dbEncryptionKeyString == nil {
        let bundleId = try! getInfoPlistValue(key: "MainAppBundleIdentifier")
        let key = "\(backupKeyPrefix)\(ethAddress.lowercased())"
        log("Fetching backup key for address \(ethAddress) from MMKV with key: \(key)", type: .debug, category: "mmkv")
        let backupKey = getValueFromMmkv(key: key, id: bundleId) ?? ""
        if backupKey != "" {
            log("Retrieved DB encryption key from MMKV backup", type: .debug, category: "mmkv")
            dbEncryptionKeyString = backupKey
        }
    }
    
    // Try SharedDefaults if both keychain and MMKV failed
    if dbEncryptionKeyString == nil {
        if let key = getSharedDefaultsValue(key: sharedDefaultsKey + ethAddress) {
            log("Retrieved DB encryption key from SharedDefaults", type: .debug, category: "sharedDefaults")
            dbEncryptionKeyString = key
        }
    }
    
    // Return nil if no key found
    guard let finalDbEncryptionKeyString = dbEncryptionKeyString else {
        log("Failed to get DB encryption key from keychain, MMKV backup, and SharedDefaults", type: .error)
        return nil
    }

    // Attempt to decode the Base64 string into Data
    guard let dbEncryptionKeyData = Data(base64Encoded: finalDbEncryptionKeyString) else {
        log("Failed to decode Base64 DB encryption key string", type: .error, category: "xmtp")
        return nil
    }

    // Validate key length
    guard dbEncryptionKeyData.count == 32 else {
        log("DB encryption key has incorrect length: \(dbEncryptionKeyData.count) bytes. Expected 32. Original string length: \(finalDbEncryptionKeyString.count)", type: .error, category: "xmtp")
        return nil
    }

    return dbEncryptionKeyData
}
