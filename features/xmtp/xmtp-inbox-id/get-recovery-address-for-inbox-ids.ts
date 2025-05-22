import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"

export async function getRecoveryAddressesForInboxIds(args: {
  clientInboxId: IXmtpInboxId
  inboxIds: IXmtpInboxId[]
}) {
  const { clientInboxId, inboxIds } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const inboxStates = await client.inboxStates(true, inboxIds)

    return inboxStates
      .filter((inboxState) => inboxState.recoveryIdentity.kind === "ETHEREUM")
      .map((inboxState) => inboxState.recoveryIdentity.identifier) as IEthereumAddress[]
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to get recovery addresses for inbox IDs",
    })
  }
}
