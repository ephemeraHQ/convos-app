import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { IEthereumAddress } from "@/utils/evm/address"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function getEthAddressesFromInboxIds(args: {
  clientInboxId: IXmtpInboxId
  inboxIds: IXmtpInboxId[]
}) {
  const { clientInboxId, inboxIds } = args
  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  const inboxStates = await client.inboxStates(true, inboxIds)

  return inboxStates.reduce(
    (acc, inboxState) => {
      const ethAddresses = inboxState.identities
        .filter((identity) => identity.kind === "ETHEREUM")
        .map((identity) => identity.identifier as IEthereumAddress)

      return {
        ...acc,
        [inboxState.inboxId]: ethAddresses,
      }
    },
    {} as Record<IXmtpInboxId, IEthereumAddress[]>,
  )
}
