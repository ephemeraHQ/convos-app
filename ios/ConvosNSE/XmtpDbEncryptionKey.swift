import Foundation

let keychainKeyPrefix = "LIBXMTP_DB_ENCRYPTION_KEY_"
let backupKeyPrefix = "BACKUP_XMTP_KEY_"
let sharedDefaultsKey = "SHARED_DEFAULTS_XMTP_KEY_"


func getDbEncryptionKey(ethAddress: String) -> Data? {
    var dbEncryptionKeyString: String?

    // Try keychain first
    if let keyFromKeychain = getKeychainValue(forKey: keychainKeyPrefix + ethAddress) {
        log.debug("Successfully retrieved DB encryption key from keychain")
        dbEncryptionKeyString = keyFromKeychain
    }

    // Try MMKV backup if keychain failed
    if dbEncryptionKeyString == nil {
        let bundleId = getInfoPlistValue(key: "MainAppBundleIdentifier")
        let key = "\(backupKeyPrefix)\(ethAddress.lowercased())"
        log.debug("Fetching backup key for address \(ethAddress) from MMKV with key: \(key)")
        let backupKey = getValueFromMmkv(key: key, id: bundleId) ?? ""
        if backupKey != "" {
            log.debug("Retrieved DB encryption key from MMKV backup")
            dbEncryptionKeyString = backupKey
        }
    }

    // Try SharedDefaults if both keychain and MMKV failed
    if dbEncryptionKeyString == nil {
        if let key = getSharedDefaultsValue(key: sharedDefaultsKey + ethAddress) {
            log.debug("Retrieved DB encryption key from SharedDefaults")
            dbEncryptionKeyString = key
        }
    }

    // Return nil if no key found
    guard let finalDbEncryptionKeyString = dbEncryptionKeyString else {
        log.error("Failed to get DB encryption key from keychain, MMKV backup, and SharedDefaults")
        return nil
    }

    // Attempt to decode the Base64 string into Data
    guard let dbEncryptionKeyData = Data(base64Encoded: finalDbEncryptionKeyString) else {
        log.error("Failed to decode Base64 DB encryption key string")
        return nil
    }

    // Validate key length
    guard dbEncryptionKeyData.count == 32 else {
        log.error("DB encryption key has incorrect length: \(dbEncryptionKeyData.count) bytes. Expected 32. Original string length: \(finalDbEncryptionKeyString.count)")
        return nil
    }

    log.debug("Successfully retrieved and validated DB encryption key")
    return dbEncryptionKeyData
}
