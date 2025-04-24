import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getInboxStates } from "@xmtp/react-native-sdk"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"

export async function xmtpInboxIdExists(args: {
  inboxId: IXmtpInboxId
  clientInboxId: IXmtpInboxId
}) {
  const { inboxId, clientInboxId } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const inboxStates = await wrapXmtpCallWithDuration("inboxStates", () =>
      getInboxStates(installationId, true, [inboxId]),
    )
    return inboxStates.length > 0
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to check if inbox ID exists: ${inboxId}`,
    })
  }
}
