import Constants from "expo-constants"
import { XMTPError } from "@/utils/error"
import { getSharedAppGroupDirectory } from "@/utils/ios-extension/ios-extensions"
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
export async function getXmtpDbDirectory() {
  return getSharedAppGroupDirectory()
}
