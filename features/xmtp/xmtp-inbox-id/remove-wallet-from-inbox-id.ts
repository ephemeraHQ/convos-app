import { PublicIdentity } from "@xmtp/react-native-sdk"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpInboxId, IXmtpSigner } from "@/features/xmtp/xmtp.types"
import { XMTPError } from "@/utils/error"
import { xmtpLogger } from "@/utils/logger"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function removeWalletFromInboxId(args: {
  inboxId: IXmtpInboxId
  signer: IXmtpSigner
  ethAddressToRemove: string
}) {
  const { inboxId, signer, ethAddressToRemove } = args

  xmtpLogger.debug(
    `[removeWalletFromInboxId] Removing wallet address ${ethAddressToRemove} from inbox ID: ${inboxId}`,
  )

  try {
    const client = await getXmtpClientByInboxId({
      inboxId,
    })

    await wrapXmtpCallWithDuration("removeAccount", () =>
      client.removeAccount(signer, new PublicIdentity(ethAddressToRemove, "ETHEREUM")),
    )

    return client
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error removing wallet address ${ethAddressToRemove} from inbox ID ${inboxId}`,
    })
  }
}
