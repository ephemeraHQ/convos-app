import { Client } from "@xmtp/react-native-sdk"
import { XMTPError } from "@/utils/error"

export function getXmtpLogs() {
  try {
    return Client.exportNativeLogs()
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Error retrieving XMTP logs",
    })
  }
}
