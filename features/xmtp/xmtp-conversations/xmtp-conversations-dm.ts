import { IXmtpDisappearingMessageSettings, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function getXmtpDmByInboxId(args: {
  clientInboxId: IXmtpInboxId
  inboxId: IXmtpInboxId
}) {
  const { clientInboxId, inboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const conversation = await wrapXmtpCallWithDuration("findDmByInboxId", () =>
      client.conversations.findDmByInboxId(inboxId),
    )

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
