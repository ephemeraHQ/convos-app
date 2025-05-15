import Constants from "expo-constants"
import { Platform } from "react-native"
import RNFS from "react-native-fs"
import { config } from "@/config"
import { XMTPError } from "@/utils/error"
import { xmtpLogger } from "@/utils/logger/logger"

export function getXmtpLocalUrl() {
  const hostIp = Constants.expoConfig?.hostUri?.split(":")[0]

  if (!hostIp) {
    throw new XMTPError({
      error: new Error("No host IP found"),
      additionalMessage: "Failed to get device IP for local XMTP environment",
    })
  }

  xmtpLogger.debug(`Setting XMTP custom host to: ${hostIp}`)

  return hostIp
}

/**
 * Gets the path to the shared App Group container directory using react-native-fs.
 * Returns null if not on iOS or if the path cannot be determined.
 */
export async function getSharedAppGroupDirectory() {
  if (Platform.OS !== "ios") {
    xmtpLogger.warn(
      "getSharedAppGroupDirectory called on non-iOS platform. App Groups are not supported.",
    )
    return null
  }

  try {
    const groupPath = await RNFS.pathForGroup(config.ios.appGroupId)

    if (!groupPath) {
      throw new Error("Failed to get App Group path via RNFS")
    }

    return groupPath
  } catch (error) {
    throw new XMTPError({ error, additionalMessage: "Failed to get App Group path via RNFS" })
  }
}
