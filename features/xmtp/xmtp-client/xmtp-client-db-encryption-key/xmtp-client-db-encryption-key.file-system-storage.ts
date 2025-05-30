import { Platform } from "react-native"
import RNFS from "react-native-fs"
import { ILowercaseEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { getXmtpDbDirectory } from "../xmtp-client-utils"

// NEVER CHANGE THIS PREFIX unless you know what you are doing
const FILE_BACKUP_PREFIX = "FILE_BACKUP_XMTP_DB_ENCRYPTION_KEY_"

export async function _saveToFileBackup(ethAddress: ILowercaseEthereumAddress, value: string) {
  if (Platform.OS !== "ios") {
    xmtpLogger.debug("File backup only supported on iOS, skipping")
    return
  }

  try {
    const groupPath = await getXmtpDbDirectory()
    if (!groupPath) {
      xmtpLogger.warn("No app group path available for file backup")
      return
    }

    const keyFileName = `${FILE_BACKUP_PREFIX}${ethAddress}.key`
    const keyFilePath = `${groupPath}/${keyFileName}`

    await RNFS.writeFile(keyFilePath, value, "utf8")
    xmtpLogger.debug(`Saved encryption key to file backup for ${ethAddress}`)
  } catch (error) {
    xmtpLogger.warn(`Failed to save encryption key to file backup for ${ethAddress}`, { error })
  }
}

export async function _getFromFileBackup(
  ethAddress: ILowercaseEthereumAddress,
): Promise<string | null> {
  if (Platform.OS !== "ios") {
    return null
  }

  try {
    const groupPath = await getXmtpDbDirectory()
    if (!groupPath) {
      return null
    }

    const keyFileName = `${FILE_BACKUP_PREFIX}${ethAddress}.key`
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

export async function _deleteFromFileBackup(ethAddress: ILowercaseEthereumAddress) {
  if (Platform.OS !== "ios") {
    return
  }

  try {
    const groupPath = await getXmtpDbDirectory()
    if (!groupPath) {
      return
    }

    const keyFileName = `${FILE_BACKUP_PREFIX}${ethAddress}.key`
    const keyFilePath = `${groupPath}/${keyFileName}`

    if (await RNFS.exists(keyFilePath)) {
      await RNFS.unlink(keyFilePath)
      xmtpLogger.debug(`Deleted encryption key file backup for ${ethAddress}`)
    }
  } catch (error) {
    xmtpLogger.warn(`Failed to delete encryption key file backup for ${ethAddress}`, { error })
  }
}
