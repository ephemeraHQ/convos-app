import { getRandomBytesAsync } from "expo-crypto"
import { XMTPError } from "@/utils/error"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { secureStorage } from "@/utils/storage/secure-storage"
import { storage } from "@/utils/storage/storage"

const DB_ENCRYPTION_KEY_STORAGE_KEY_STRING = "LIBXMTP_DB_ENCRYPTION_KEY"
const BACKUP_PREFIX = "BACKUP_XMTP_KEY_"

export async function cleanXmtpDbEncryptionKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  const DB_ENCRYPTION_KEY = getXmtpDbEncryptionStorageKey({ ethAddress })
  await secureStorage.deleteItem(DB_ENCRYPTION_KEY)

  // Also clean backup
  const backupKey = getBackupStorageKey({ ethAddress })
  storage.delete(backupKey)
}

export async function getOrCreateXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args

  const DB_ENCRYPTION_KEY_STORAGE_KEY = getXmtpDbEncryptionStorageKey({ ethAddress })

  xmtpLogger.debug(`Getting XMTP DB encryption key for ${ethAddress}`)

  try {
    // Check if key exists in secure storage
    const existingKey = await secureStorage.getItem(DB_ENCRYPTION_KEY_STORAGE_KEY)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress}`)

      // Ensure backup exists
      saveToBackup(ethAddress, existingKey)

      return new Uint8Array(Buffer.from(existingKey, "base64"))
    }

    // Check if key exists in old storage
    // Delete in ~1 month when most people have logged in at least once
    xmtpLogger.debug(
      `No existing DB encryption key found for ${ethAddress}, checking old storage...`,
    )
    const oldExistingKey = await secureStorage.getItem(DB_ENCRYPTION_KEY_STORAGE_KEY_STRING)
    if (oldExistingKey) {
      xmtpLogger.debug(`Found old DB encryption key`)
      await secureStorage.setItem(DB_ENCRYPTION_KEY_STORAGE_KEY, oldExistingKey)

      // Also save to backup
      saveToBackup(ethAddress, oldExistingKey)

      return new Uint8Array(Buffer.from(oldExistingKey, "base64"))
    }

    // Check if key exists in backup
    const backupKey = getFromBackup(ethAddress)
    if (backupKey) {
      xmtpLogger.debug(`Found backup DB encryption key for ${ethAddress}`)

      // Restore to secure storage
      await secureStorage.setItem(DB_ENCRYPTION_KEY_STORAGE_KEY, backupKey)

      return new Uint8Array(Buffer.from(backupKey, "base64"))
    }

    // Create new key
    xmtpLogger.debug(
      `Can't find existing DB encryption key for ${ethAddress}, creating a new one...`,
    )
    const newKey = Buffer.from(await getRandomBytesAsync(32)).toString("base64")
    await secureStorage.setItem(DB_ENCRYPTION_KEY_STORAGE_KEY, newKey)

    // Save to backup
    saveToBackup(ethAddress, newKey)

    xmtpLogger.debug(`Created new DB encryption key for ${ethAddress}`)
    return new Uint8Array(Buffer.from(newKey, "base64"))
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to get or create DB encryption key",
    })
  }
}

// Gets the encryption key from backup when secure storage fails
export async function getBackupXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args
  xmtpLogger.debug(`Trying to get backup XMTP DB encryption key for ${ethAddress}`)

  const backupKey = getFromBackup(ethAddress)
  if (!backupKey) {
    throw new XMTPError({
      error: new Error("No backup key found"),
      additionalMessage: `No backup encryption key found for ${ethAddress}`,
    })
  }

  // Return in the expected format
  return new Uint8Array(Buffer.from(backupKey, "base64"))
}

function getXmtpDbEncryptionStorageKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  return `${DB_ENCRYPTION_KEY_STORAGE_KEY_STRING}_${ethAddress}`
}

function getBackupStorageKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  return `${BACKUP_PREFIX}${ethAddress}`
}

function saveToBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  const backupKey = getBackupStorageKey({ ethAddress })
  storage.set(backupKey, value)
  xmtpLogger.debug(`Saved encryption key to backup for ${ethAddress}`)
}

function getFromBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const backupKey = getBackupStorageKey({ ethAddress })
  const value = storage.getString(backupKey)
  return value || null
}
