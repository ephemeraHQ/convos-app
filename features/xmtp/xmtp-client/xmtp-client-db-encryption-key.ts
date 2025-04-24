import { getRandomBytesAsync } from "expo-crypto"
import { XMTPError } from "@/utils/error"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { secureStorage } from "@/utils/storage/secure-storage"
import { storage } from "@/utils/storage/storage"

// Constants
const DB_ENCRYPTION_KEY_STORAGE_KEY_STRING = "LIBXMTP_DB_ENCRYPTION_KEY" // NEVER CHANGE THIS
const BACKUP_PREFIX = "BACKUP_XMTP_KEY_" // NEVER CHANGE THIS
const XMTP_KEY_LENGTH = 32

// Storage key utilities
function _getSecureStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${DB_ENCRYPTION_KEY_STORAGE_KEY_STRING}_${ethAddress}`
}

function _getBackupStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${BACKUP_PREFIX}${ethAddress}`
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
  storage.set(backupKey, value)
  xmtpLogger.debug(`Saved encryption key to backup for ${ethAddress}`)
}

function _getFromBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const backupKey = _getBackupStorageKey(ethAddress)
  const value = storage.getString(backupKey)
  return value || null
}

function _deleteFromBackup(ethAddress: ILowercaseEthereumAddress) {
  const backupKey = _getBackupStorageKey(ethAddress)
  storage.delete(backupKey)
}

// Key management operations
async function _saveKey(args: { ethAddress: ILowercaseEthereumAddress; key: string }) {
  const { ethAddress, key } = args
  const storageKey = _getSecureStorageKey(ethAddress)

  try {
    await secureStorage.setItem(storageKey, key)
    xmtpLogger.debug(`Saved DB encryption key for ${ethAddress}`)
    _saveToBackup(ethAddress, key)
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
}

export async function getOrCreateXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args

  xmtpLogger.debug(`Getting XMTP DB encryption key for ${ethAddress}`)

  try {
    // Check if key exists in secure storage
    const existingKey = await _getFromSecureStorage(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress}`)
      return _formatKey(existingKey)
    }

    // Create new key
    xmtpLogger.debug(`Creating new DB encryption key for ${ethAddress}`)
    const newKey = await _generateKey()

    // Save to secure storage and backup
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
