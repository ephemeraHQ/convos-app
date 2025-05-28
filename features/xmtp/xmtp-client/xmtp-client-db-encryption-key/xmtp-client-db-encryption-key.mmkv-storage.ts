import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { xmtpDbEncryptionKeyMmkvStorage } from "@/utils/storage/storages"

// NEVER CHANGE THIS PREFIX unless you know what you are doing
const BACKUP_PREFIX = "BACKUP_XMTP_KEY_"

function _getBackupStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${BACKUP_PREFIX}${ethAddress}`
}

export function _saveToBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  const backupKey = _getBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeyMmkvStorage.set(backupKey, value)
  xmtpLogger.debug(`Saved encryption key to backup for ${ethAddress}`)
}

export function _getFromBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const backupKey = _getBackupStorageKey(ethAddress)
  const value = xmtpDbEncryptionKeyMmkvStorage.getString(backupKey)
  return value || null
}

export function _deleteFromBackup(ethAddress: ILowercaseEthereumAddress) {
  const backupKey = _getBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeyMmkvStorage.delete(backupKey)
}
