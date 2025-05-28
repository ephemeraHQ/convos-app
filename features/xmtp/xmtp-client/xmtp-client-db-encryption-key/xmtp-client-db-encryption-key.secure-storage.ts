import { XMTPError } from "@/utils/error"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { xmtpDbEncryptionKeySecureStorage } from "@/utils/storage/storages"

// NEVER CHANGE THIS PREFIX unless you know what you are doing
const DB_ENCRYPTION_KEY_STORAGE_KEY_STRING = "LIBXMTP_DB_ENCRYPTION_KEY"

function _getSecureStorageKey(ethAddress: ILowercaseEthereumAddress) {
  return `${DB_ENCRYPTION_KEY_STORAGE_KEY_STRING}_${ethAddress}`
}

export async function _getFromSecureStorage(
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

export async function _saveToSecureStorage(ethAddress: ILowercaseEthereumAddress, key: string) {
  const storageKey = _getSecureStorageKey(ethAddress)

  try {
    await xmtpDbEncryptionKeySecureStorage.setItem(storageKey, key)
    xmtpLogger.debug(`Saved DB encryption key for ${ethAddress} at ${storageKey}`)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to save DB encryption key for ${ethAddress}`,
    })
  }
}

export async function _deleteFromSecureStorage(ethAddress: ILowercaseEthereumAddress) {
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
