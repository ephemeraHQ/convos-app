import {
  IXmtpConversationId,
  IXmtpDisappearingMessageSettings,
  IXmtpInboxId,
} from "@features/xmtp/xmtp.types"
import { dmPeerInboxId } from "@xmtp/react-native-sdk"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function getXmtpDmByInboxId(args: {
  clientInboxId: IXmtpInboxId
  inboxId: IXmtpInboxId
}) {
  const { clientInboxId, inboxId } = args

  try {
    const conversation = await wrapXmtpCallWithDuration("findDmByInboxId", async () => {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })
      return client.conversations.findDmByInboxId(inboxId)
    })

    return conversation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get conversation for inbox ID: ${inboxId}`,
    })
  }
}

export async function createXmtpDm(args: {
  senderClientInboxId: IXmtpInboxId
  peerInboxId: IXmtpInboxId
  disappearingMessageSettings?: IXmtpDisappearingMessageSettings
}) {
  const { senderClientInboxId, peerInboxId, disappearingMessageSettings } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: senderClientInboxId,
    })

    const conversation = await wrapXmtpCallWithDuration("findOrCreateDm", () =>
      client.conversations.findOrCreateDm(peerInboxId, disappearingMessageSettings),
    )

    return conversation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to create XMTP DM with inbox ID: ${peerInboxId}`,
    })
  }
}

export async function getXmtpDmPeerInboxId(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const inboxId = await wrapXmtpCallWithDuration("peerInboxId", () =>
      dmPeerInboxId(client.installationId, xmtpConversationId),
    )

    return inboxId as unknown as IXmtpInboxId
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get peer inbox ID for conversation ${xmtpConversationId}`,
    })
  }
}
