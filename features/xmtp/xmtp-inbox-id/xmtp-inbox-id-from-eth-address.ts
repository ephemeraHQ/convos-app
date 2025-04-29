import { PublicIdentity } from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { GenericError, XMTPError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"

export async function getInboxIdFromEthAddress(args: {
  clientInboxId: IXmtpInboxId
  targetEthAddress: IEthereumAddress
}) {
  const { clientInboxId, targetEthAddress } = args

  xmtpLogger.debug(
    `[getInboxIdFromEthAddress] Getting inbox ID from Ethereum address: ${targetEthAddress} for client: ${clientInboxId}`,
  )

  if (!clientInboxId) {
    throw new GenericError({
      error: new Error("Invalid client inbox ID"),
      additionalMessage: "Invalid client inbox ID",
    })
  }

  if (!targetEthAddress) {
    throw new GenericError({
      error: new Error("Invalid target Ethereum address"),
      additionalMessage: "Invalid target Ethereum address",
    })
  }

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const inboxId = (await wrapXmtpCallWithDuration("findInboxIdFromIdentity", () =>
      client.findInboxIdFromIdentity(new PublicIdentity(targetEthAddress, "ETHEREUM")),
    )) as unknown as IXmtpInboxId

    return inboxId
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to get inbox ID from address",
    })
  }
}
