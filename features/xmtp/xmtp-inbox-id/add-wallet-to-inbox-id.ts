import { IXmtpInboxId, IXmtpSigner } from "@features/xmtp/xmtp.types"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { xmtpLogger } from "@/utils/logger"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function addWalletToInboxId(args: {
  inboxId: IXmtpInboxId
  wallet: IXmtpSigner
  allowReassignInboxId?: boolean
}) {
  const { inboxId, wallet, allowReassignInboxId = false } = args

  const walletIdentifier = await wallet.getIdentifier()

  xmtpLogger.debug(
    `[addWalletToInboxId] Adding wallet ${walletIdentifier} to inbox ID: ${inboxId} with allowReassignInboxId: ${allowReassignInboxId}`,
  )

  try {
    const client = await getXmtpClientByInboxId({
      inboxId,
    })

    await wrapXmtpCallWithDuration("addAccount", () =>
      client.addAccount(wallet, allowReassignInboxId),
    )

    return client
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error adding wallet ${walletIdentifier} to inbox ID for inboxId ${inboxId}`,
    })
  }
}
