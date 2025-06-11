import {
  getDebugInformation,
  getNetworkDebugInformation,
  uploadDebugInformation,
} from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { GenericError, XMTPError } from "@/utils/error"

export async function getXmtpDebugInformationConversation(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const conversationDebugInformation = await getDebugInformation(
      client.installationId,
      xmtpConversationId,
    )

    return conversationDebugInformation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get conversation debug information for inbox ${clientInboxId}`,
    })
  }
}

export async function getXmtpDebugInformationNetwork(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const networkDebugInformation = await getNetworkDebugInformation(client.installationId)

    return networkDebugInformation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get network debug information for inbox ${clientInboxId}`,
    })
  }
}

export async function uploadXmtpDebugInformation(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args
  try {
    const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })
    return wrapXmtpCallWithDuration("uploadDebugInformation", () =>
      uploadDebugInformation(client.installationId),
    )
  } catch (error) {
    throw new GenericError({
      error,
      additionalMessage: "Failed to upload XMTP debug information",
    })
  }
}
