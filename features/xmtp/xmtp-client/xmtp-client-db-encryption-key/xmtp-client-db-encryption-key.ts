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
import { _formatKey, _generateKey } from "./xmtp-client-db-encryption-key.utils"

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

export async function getOrCreateXmtpDbEncryptionKey(args: {
  ethAddress: ILowercaseEthereumAddress
}) {
  const { ethAddress } = args

  xmtpLogger.debug(`Getting XMTP DB encryption key for ${ethAddress}`)

  try {
    let existingKey = await _getFromSecureStorage(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in secure storage`)
      _saveToBackup(ethAddress, existingKey)
      _saveToSecondBackup(ethAddress, existingKey)
      await _saveToFileBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    existingKey = _getFromBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in backup storage`)
      await _saveToSecureStorage(ethAddress, existingKey)
      _saveToSecondBackup(ethAddress, existingKey)
      await _saveToFileBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    existingKey = _getFromSecondBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in second backup`)
      await _saveToSecureStorage(ethAddress, existingKey)
      _saveToBackup(ethAddress, existingKey)
      await _saveToFileBackup(ethAddress, existingKey)
      return _formatKey(existingKey)
    }

    existingKey = await _getFromFileBackup(ethAddress)
    if (existingKey) {
      xmtpLogger.debug(`Found existing DB encryption key for ${ethAddress} in file backup`)
      await _saveToSecureStorage(ethAddress, existingKey)
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
