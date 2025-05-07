import { getRandomBytesAsync } from "expo-crypto"
import { config } from "@/config"
import { XMTPError } from "@/utils/error"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { secureStorage } from "@/utils/storage/secure-storage"
import { sharedDefaults } from "@/utils/storage/shared-defaults"
import { createStorage } from "@/utils/storage/storage"

// Constants
const DB_ENCRYPTION_KEY_STORAGE_KEY_STRING = "LIBXMTP_DB_ENCRYPTION_KEY" // NEVER CHANGE THIS
const BACKUP_PREFIX = "BACKUP_XMTP_KEY_" // NEVER CHANGE THIS
const SHARED_DEFAULTS_PREFIX = "SHARED_DEFAULTS_XMTP_KEY_" // NEVER CHANGE THIS
const XMTP_KEY_LENGTH = 32
const backupStorage = createStorage({ id: config.app.bundleId })

// Storage key utilities
function _getSecureStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${DB_ENCRYPTION_KEY_STORAGE_KEY_STRING}_${ethAddress}`
}

function _getBackupStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${BACKUP_PREFIX}${ethAddress}`
}

function _getSharedDefaultsStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${SHARED_DEFAULTS_PREFIX}${ethAddress}`
}

// Key format utilities
function _formatKey(base64Key: string): Uint8Array {
  const keyArray = new Uint8Array(Buffer.from(base64Key, "base64"))

  if (keyArray.length !== XMTP_KEY_LENGTH) {
    throw new XMTPError({
      error: new Error(`Invalid key length: ${keyArray.length}. Expected ${XMTP_KEY_LENGTH} bytes`),
      additionalMessage: "XMTP encryption key has invalid length",
    })
  }

  return keyArray
}

async function _generateKey(): Promise<string> {
  return Buffer.from(await getRandomBytesAsync(XMTP_KEY_LENGTH)).toString("base64")
}

// Secure storage operations
async function _getFromSecureStorage(
  ethAddress: ILowercaseEthereumAddress,
): Promise<string | null> {
  const storageKey = _getSecureStorageKey(ethAddress)

  try {
    return await secureStorage.getItem(storageKey)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get DB encryption key for ${ethAddress}`,
    })
  }
}

export async function deleteDbKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  const storageKey = _getSecureStorageKey(ethAddress)

  try {
    await secureStorage.deleteItem(storageKey)
    xmtpLogger.debug(`Deleted DB encryption key for ${ethAddress}`)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to delete DB encryption key for ${ethAddress}`,
    })
  }
}

// Backup storage operations
function _saveToBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  const backupKey = _getBackupStorageKey(ethAddress)
  backupStorage.set(backupKey, value)
  xmtpLogger.debug(`Saved encryption key to backup for ${ethAddress}`)
}

function _getFromBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const backupKey = _getBackupStorageKey(ethAddress)
  const value = backupStorage.getString(backupKey)
  return value || null
}

function _deleteFromBackup(ethAddress: ILowercaseEthereumAddress) {
  const backupKey = _getBackupStorageKey(ethAddress)
  backupStorage.delete(backupKey)
}

// Shared defaults storage operations
function _saveToSharedDefaults(ethAddress: ILowercaseEthereumAddress, value: string) {
  const sharedDefaultsKey = _getSharedDefaultsStorageKey(ethAddress)
  sharedDefaults.setValue(sharedDefaultsKey, value)
  xmtpLogger.debug(`Saved encryption key to shared defaults for ${ethAddress}`)
}

function _getFromSharedDefaults(ethAddress: ILowercaseEthereumAddress): string | null {
  const sharedDefaultsKey = _getSharedDefaultsStorageKey(ethAddress)
  const value = sharedDefaults.getValue(sharedDefaultsKey)
  return typeof value === "string" ? value : null
}

function _deleteFromSharedDefaults(ethAddress: ILowercaseEthereumAddress) {
  const sharedDefaultsKey = _getSharedDefaultsStorageKey(ethAddress)
  sharedDefaults.setValue(sharedDefaultsKey, "")
  xmtpLogger.debug(`"Deleted" encryption key from shared defaults for ${ethAddress}`)
}

// Key management operations
export async function _saveKey(args: { ethAddress: ILowercaseEthereumAddress; key: string }) {
  const { ethAddress, key } = args
  const storageKey = _getSecureStorageKey(ethAddress)

  try {
    await secureStorage.setItem(storageKey, key)
    xmtpLogger.debug(`Saved DB encryption key for ${ethAddress} at ${storageKey}`)
    _saveToBackup(ethAddress, key)
    _saveToSharedDefaults(ethAddress, key)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to save DB encryption key for ${ethAddress}`,
    })
  }
}

// Public API
export async function cleanXmtpDbEncryptionKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  await deleteDbKey({ ethAddress })
  _deleteFromBackup(ethAddress)
  _deleteFromSharedDefaults(ethAddress)
}

export async function getOrCreateXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args

  xmtpLogger.debug(`Getting XMTP DB encryption key for ${ethAddress}`)

  try {
    // Check if key exists in secure storage
    let existingKey = await _getFromSecureStorage(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in secure storage`)
      // Ensure backups are consistent
      _saveToBackup(ethAddress, existingKey)
      _saveToSharedDefaults(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    // Check if key exists in backup storage
    existingKey = _getFromBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in backup storage`)
      // Restore to secure storage and shared defaults
      await secureStorage.setItem(_getSecureStorageKey(ethAddress), existingKey)
      _saveToSharedDefaults(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    // Check if key exists in shared defaults
    existingKey = _getFromSharedDefaults(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in shared defaults`)
      // Restore to secure storage and backup
      await secureStorage.setItem(_getSecureStorageKey(ethAddress), existingKey)
      _saveToBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    // Create new key
    xmtpLogger.debug(`Creating new DB encryption key for ${ethAddress}`)
    const newKey = await _generateKey()

    // Save to secure storage and backups
    await _saveKey({ ethAddress, key: newKey })

    return _formatKey(newKey)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to get or create DB encryption key",
    })
  }
}

export async function getBackupXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args
  xmtpLogger.debug(`Trying to get backup XMTP DB encryption key for ${ethAddress}`)

  const backupKey = _getFromBackup(ethAddress)
  if (!backupKey) {
    throw new XMTPError({
      error: new Error("No backup key found"),
      additionalMessage: `No backup encryption key found for ${ethAddress}`,
    })
  }

  return _formatKey(backupKey)
}

// For debugging ios notification extensions
// const ethAddress = "0x916955d77401c13cdfddda8e40b100a743ea689f" as ILowercaseEthereumAddress

// const sharedDefaultValue = sharedDefaults.getValue(_getSharedDefaultsStorageKey(ethAddress))
// console.log("test:", sharedDefaultValue)

// const backupValue = _getFromBackup(ethAddress)
// console.log("backupKey:", backupValue)

// _getFromSecureStorage(ethAddress).then((value) => {
//   console.log("secureValue:", value)
// })
