import Constants from "expo-constants"
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

  xmtpLogger.debug(`Getting XMTP local URL for host IP: ${hostIp}`)

  return hostIp
}
