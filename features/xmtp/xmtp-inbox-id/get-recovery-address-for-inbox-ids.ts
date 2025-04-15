import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getInboxStates } from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { IEthereumAddress } from "@/utils/evm/address"

export async function getRecoveryAddressesForInboxIds(args: {
  clientInboxId: IXmtpInboxId
  inboxIds: IXmtpInboxId[]
}) {
  const { clientInboxId, inboxIds } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  const inboxStates = await getInboxStates(client.installationId, true, inboxIds)

  return inboxStates
    .filter((inboxState) => inboxState.recoveryIdentity.kind === "ETHEREUM")
    .map((inboxState) => inboxState.recoveryIdentity.identifier) as IEthereumAddress[]
}
