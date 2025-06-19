import { XMTPError } from "@/utils/error"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import {
  _deleteFromFileBackup,
  _getFromFileBackup,
  _saveToFileBackup,
} from "./xmtp-client-db-encryption-key.file-system-storage"
import {
  _deleteFromBackup,
  _getFromBackup,
  _saveToBackup,
} from "./xmtp-client-db-encryption-key.mmkv-storage"
import {
  _deleteFromSecureStorage,
  _getFromSecureStorage,
  _saveToSecureStorage,
} from "./xmtp-client-db-encryption-key.secure-storage"
import {
  _deleteFromSecondBackup,
  _getFromSecondBackup,
  _saveToSecondBackup,
} from "./xmtp-client-db-encryption-key.shared-defaults-storage"
import { generateXmtpDbEncryptionKey } from "./xmtp-client-db-encryption-key.utils"

async function _saveKey(args: { ethAddress: ILowercaseEthereumAddress; key: string }) {
  const { ethAddress, key } = args

  try {
    await _saveToSecureStorage(ethAddress, key)
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

export async function deleteDbKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  await _deleteFromSecureStorage(ethAddress)
}

export async function cleanXmtpDbEncryptionKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args
  await deleteDbKey({ ethAddress })
  _deleteFromBackup(ethAddress)
  _deleteFromSecondBackup(ethAddress)
  await _deleteFromFileBackup(ethAddress)
}

export async function getXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
  useBackupNumber?: "first" | "second" | "third"
}) {
  const { ethAddress, useBackupNumber } = args

  xmtpLogger.debug(`Getting XMTP DB encryption key for ${ethAddress}`)

  try {
    // Secure storage (primary)
    if (!useBackupNumber) {
      let existingKey = await _getFromSecureStorage(ethAddress)
      if (existingKey) {
        xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in secure storage`)
        _saveToBackup(ethAddress, existingKey)
        _saveToSecondBackup(ethAddress, existingKey)
        await _saveToFileBackup(ethAddress, existingKey)
        return existingKey
      }
    }

    // First backup (MMKV)
    if (!useBackupNumber || useBackupNumber === "first") {
      let existingKey = _getFromBackup(ethAddress)
      if (existingKey) {
        xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in backup storage`)
        await _saveToSecureStorage(ethAddress, existingKey)
        _saveToSecondBackup(ethAddress, existingKey)
        await _saveToFileBackup(ethAddress, existingKey)
        return existingKey
      }
    }

    // Second backup (Shared Defaults)
    if (!useBackupNumber || useBackupNumber === "second") {
      let existingKey = _getFromSecondBackup(ethAddress)
      if (existingKey) {
        xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in second backup`)
        await _saveToSecureStorage(ethAddress, existingKey)
        _saveToBackup(ethAddress, existingKey)
        await _saveToFileBackup(ethAddress, existingKey)
        return existingKey
      }
    }

    // Third backup (File System)
    if (!useBackupNumber || useBackupNumber === "third") {
      let existingKey = await _getFromFileBackup(ethAddress)
      if (existingKey) {
        xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in file backup`)
        await _saveToSecureStorage(ethAddress, existingKey)
        _saveToBackup(ethAddress, existingKey)
        _saveToSecondBackup(ethAddress, existingKey)
        return existingKey
      }
    }

    return null
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to get DB encryption key",
    })
  }
}

export async function createXmtpDbEncryptionKey(args: { ethAddress: ILowercaseEthereumAddress }) {
  const { ethAddress } = args

  xmtpLogger.debug(`Creating new DB encryption key for ${ethAddress}`)
  const newKey = await generateXmtpDbEncryptionKey()

  await _saveKey({ ethAddress, key: newKey })

  return newKey
}
