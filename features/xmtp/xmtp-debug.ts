import { uploadDebugInformation } from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { GenericError } from "@/utils/error"

export async function uploadXmtpDebugInformation(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args
  try {
    const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })
    return wrapXmtpCallWithDuration("uploadDebugInformation", () =>
      uploadDebugInformation(client.installationId),
    )
  } catch (error) {
    throw new GenericError({
      error,
      additionalMessage: "Failed to upload XMTP debug information",
    })
  }
}
