import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getInboxStates } from "@xmtp/react-native-sdk"
import { IEthereumAddress } from "@/utils/evm/address"
import { ensureXmtpInstallationQueryData } from "../xmtp-installations/xmtp-installation.query"

export async function getEthAddressesFromInboxIds(args: {
  clientInboxId: IXmtpInboxId
  inboxIds: IXmtpInboxId[]
}) {
  const { clientInboxId, inboxIds } = args

  const installationId = await ensureXmtpInstallationQueryData({
    inboxId: clientInboxId,
  })

  const inboxStates = await getInboxStates(installationId, true, inboxIds)

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
