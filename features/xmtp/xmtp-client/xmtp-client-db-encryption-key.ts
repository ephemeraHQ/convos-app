import { getRandomBytesAsync } from "expo-crypto"
import { Platform } from "react-native"
import RNFS from "react-native-fs"
import { XMTPError } from "@/utils/error"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import {
  xmtpDbEncryptionKeyMmkvStorage,
  xmtpDbEncryptionKeySecureStorage,
  xmtpDbEncryptionKeySharedDefaultBackupStorage,
} from "@/utils/storage/storages"
import { getSharedAppGroupDirectory } from "./xmtp-client-utils"

// Constants
const DB_ENCRYPTION_KEY_STORAGE_KEY_STRING = "LIBXMTP_DB_ENCRYPTION_KEY" // NEVER CHANGE THIS
const BACKUP_PREFIX = "BACKUP_XMTP_KEY_" // NEVER CHANGE THIS
const SECOND_BACKUP_PREFIX = "SHARED_DEFAULTS_XMTP_KEY_" // NEVER CHANGE THIS
const XMTP_KEY_LENGTH = 32

// Storage key utilities
function _getSecureStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${DB_ENCRYPTION_KEY_STORAGE_KEY_STRING}_${ethAddress}`
}

function _getBackupStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${BACKUP_PREFIX}${ethAddress}`
}

function _getSecondBackupStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${SECOND_BACKUP_PREFIX}${ethAddress}`
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
    return await xmtpDbEncryptionKeySecureStorage.getItem(storageKey)
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
    await xmtpDbEncryptionKeySecureStorage.deleteItem(storageKey)
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
  xmtpDbEncryptionKeyMmkvStorage.set(backupKey, value)
  xmtpLogger.debug(`Saved encryption key to backup for ${ethAddress}`)
}

function _getFromBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const backupKey = _getBackupStorageKey(ethAddress)
  const value = xmtpDbEncryptionKeyMmkvStorage.getString(backupKey)
  return value || null
}

function _deleteFromBackup(ethAddress: ILowercaseEthereumAddress) {
  const backupKey = _getBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeyMmkvStorage.delete(backupKey)
}

function _saveToSecondBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  const sharedDefaultsKey = _getSecondBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeySharedDefaultBackupStorage.setValue(sharedDefaultsKey, value)
  xmtpLogger.debug(`Saved encryption key to second backup for ${ethAddress}`)
}

function _getFromSecondBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const sharedDefaultsKey = _getSecondBackupStorageKey(ethAddress)
  const value = xmtpDbEncryptionKeySharedDefaultBackupStorage.getValue(sharedDefaultsKey)
  return typeof value === "string" ? value : null
}

function _deleteFromSecondBackup(ethAddress: ILowercaseEthereumAddress) {
  const sharedDefaultsKey = _getSecondBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeySharedDefaultBackupStorage.deleteValue(sharedDefaultsKey)
  xmtpLogger.debug(`"Deleted" encryption key from second backup for ${ethAddress}`)
}

// File-based storage operations
async function _saveToFileBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  if (Platform.OS !== "ios") {
    xmtpLogger.debug("File backup only supported on iOS, skipping")
    return
  }

  try {
    const groupPath = await getSharedAppGroupDirectory()
    if (!groupPath) {
      xmtpLogger.warn("No app group path available for file backup")
      return
    }

    const keyFileName = `${BACKUP_PREFIX}${ethAddress}.key`
    const keyFilePath = `${groupPath}/${keyFileName}`

    await RNFS.writeFile(keyFilePath, value, "utf8")
    xmtpLogger.debug(`Saved encryption key to file backup for ${ethAddress}`)
  } catch (error) {
    xmtpLogger.warn(`Failed to save encryption key to file backup for ${ethAddress}`, { error })
  }
}

async function _getFromFileBackup(ethAddress: ILowercaseEthereumAddress): Promise<string | null> {
  if (Platform.OS !== "ios") {
    return null
  }

  try {
    const groupPath = await getSharedAppGroupDirectory()
    if (!groupPath) {
      return null
    }

    const keyFileName = `${BACKUP_PREFIX}${ethAddress}.key`
    const keyFilePath = `${groupPath}/${keyFileName}`

    if (await RNFS.exists(keyFilePath)) {
      const value = await RNFS.readFile(keyFilePath, "utf8")
      xmtpLogger.debug(`Retrieved encryption key from file backup for ${ethAddress}`)
      return value
    }

    return null
  } catch (error) {
    xmtpLogger.debug(`Failed to read encryption key from file backup for ${ethAddress}`, { error })
    return null
  }
}

async function _deleteFromFileBackup(ethAddress: ILowercaseEthereumAddress) {
  if (Platform.OS !== "ios") {
    return
  }

  try {
    const groupPath = await getSharedAppGroupDirectory()
    if (!groupPath) {
      return
    }

    const keyFileName = `${BACKUP_PREFIX}${ethAddress}.key`
    const keyFilePath = `${groupPath}/${keyFileName}`

    if (await RNFS.exists(keyFilePath)) {
      await RNFS.unlink(keyFilePath)
      xmtpLogger.debug(`Deleted encryption key file backup for ${ethAddress}`)
    }
  } catch (error) {
    xmtpLogger.warn(`Failed to delete encryption key file backup for ${ethAddress}`, { error })
  }
}

// Key management operations
export async function _saveKey(args: { ethAddress: ILowercaseEthereumAddress; key: string }) {
  const { ethAddress, key } = args
  const storageKey = _getSecureStorageKey(ethAddress)

  try {
    await xmtpDbEncryptionKeySecureStorage.setItem(storageKey, key)
    xmtpLogger.debug(`Saved DB encryption key for ${ethAddress} at ${storageKey}`)
    _saveToBackup(ethAddress, key)
    _saveToSecondBackup(ethAddress, key)
    await _saveToFileBackup(ethAddress, key)
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
  _deleteFromSecondBackup(ethAddress)
  await _deleteFromFileBackup(ethAddress)
}

export async function getOrCreateXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args

  xmtpLogger.debug(`Getting XMTP DB encryption key for ${ethAddress}`)

  try {
    let existingKey = await _getFromSecureStorage(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in secure storage`)
      // Ensure backups are consistent
      _saveToBackup(ethAddress, existingKey)
      _saveToSecondBackup(ethAddress, existingKey)
      await _saveToFileBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    // Check if key exists in backup storage
    existingKey = _getFromBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in backup storage`)

      await xmtpDbEncryptionKeySecureStorage.setItem(_getSecureStorageKey(ethAddress), existingKey)
      _saveToSecondBackup(ethAddress, existingKey)
      await _saveToFileBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    existingKey = _getFromSecondBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in second backup`)

      await xmtpDbEncryptionKeySecureStorage.setItem(_getSecureStorageKey(ethAddress), existingKey)
      _saveToBackup(ethAddress, existingKey)
      await _saveToFileBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    // Check if key exists in file backup
    existingKey = await _getFromFileBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in file backup`)

      await xmtpDbEncryptionKeySecureStorage.setItem(_getSecureStorageKey(ethAddress), existingKey)
      _saveToBackup(ethAddress, existingKey)
      _saveToSecondBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    xmtpLogger.debug(`Creating new DB encryption key for ${ethAddress}`)
    const newKey = await _generateKey()

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
