import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { xmtpDbEncryptionKeySharedDefaultBackupStorage } from "@/utils/storage/storages"

// NEVER CHANGE THIS PREFIX unless you know what you are doing
const SECOND_BACKUP_PREFIX = "SHARED_DEFAULTS_XMTP_KEY_"

function _getSecondBackupStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${SECOND_BACKUP_PREFIX}${ethAddress}`
}

export function _saveToSecondBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  const sharedDefaultsKey = _getSecondBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeySharedDefaultBackupStorage.setValue(sharedDefaultsKey, value)
  xmtpLogger.debug(`Saved encryption key to second backup for ${ethAddress}`)
}

export function _getFromSecondBackup(ethAddress: ILowercaseEthereumAddress): string | null {
  const sharedDefaultsKey = _getSecondBackupStorageKey(ethAddress)
  const value = xmtpDbEncryptionKeySharedDefaultBackupStorage.getValue(sharedDefaultsKey)
  return typeof value === "string" ? value : null
}

export function _deleteFromSecondBackup(ethAddress: ILowercaseEthereumAddress) {
  const sharedDefaultsKey = _getSecondBackupStorageKey(ethAddress)
  xmtpDbEncryptionKeySharedDefaultBackupStorage.deleteValue(sharedDefaultsKey)
  xmtpLogger.debug(`"Deleted" encryption key from second backup for ${ethAddress}`)
}
