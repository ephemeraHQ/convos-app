import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"

export async function xmtpInboxIdExists(args: {
  inboxId: IXmtpInboxId
  clientInboxId: IXmtpInboxId
}) {
  const { inboxId, clientInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })
    const inboxStates = await wrapXmtpCallWithDuration("inboxStates", () =>
      client.inboxStates(true, [inboxId]),
    )
    return inboxStates.length > 0
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to check if inbox ID exists: ${inboxId}`,
    })
  }
}
