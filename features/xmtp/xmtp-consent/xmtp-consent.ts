import { IXmtpConsentState, IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"

export async function xmtpInboxIdCanMessageEthAddress(args: {
  inboxId: IXmtpInboxId
  ethAddress: IEthereumAddress
}) {
  const { inboxId, ethAddress } = args
  try {
    const client = await getXmtpClientByInboxId({
      inboxId,
    })

    const canMessageResult = await wrapXmtpCallWithDuration("canMessage", () =>
      client.canMessage([{ kind: "ETHEREUM", identifier: ethAddress }]),
    )

    return canMessageResult[ethAddress.toLowerCase()]
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to check if inbox can message eth address",
    })
  }
}

export async function getXmtpConsentStateForInboxId(args: {
  clientInboxId: IXmtpInboxId
  inboxIdToCheck: IXmtpInboxId
}) {
  const { clientInboxId, inboxIdToCheck } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })
    return client.preferences.inboxIdConsentState(inboxIdToCheck)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to get XMTP consent state for inboxId",
    })
  }
}

export async function setXmtpConsentStateForInboxId(args: {
  peerInboxId: IXmtpInboxId
  consent: IXmtpConsentState
  clientInboxId: IXmtpInboxId
}) {
  const { peerInboxId, consent, clientInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("setConsentState", () =>
      client.preferences.setConsentState({
        value: peerInboxId,
        entryType: "inbox_id",
        state: consent,
      }),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to set XMTP consent state for inboxId",
    })
  }
}

export const updateXmtpConsentForConversationForInbox = async (args: {
  conversationIds: IXmtpConversationId[]
  consent: IXmtpConsentState
  clientInboxId: IXmtpInboxId
}) => {
  const { clientInboxId, conversationIds, consent } = args
  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    for (const conversationId of conversationIds) {
      await wrapXmtpCallWithDuration("setConsentState (conversation)", () =>
        client.preferences.setConsentState({
          value: conversationId,
          entryType: "conversation_id",
          state: consent,
        }),
      )
    }
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to update consent for conversations",
    })
  }
}
