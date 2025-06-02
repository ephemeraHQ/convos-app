import {
  clearDisappearingMessageSettings,
  disappearingMessageSettings,
  isDisappearingMessagesEnabled,
  updateDisappearingMessageSettings,
} from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getTodayNs } from "@/utils/date"
import { XMTPError } from "@/utils/error"

/**
 * Get the current disappearing message settings for a conversation
 */
export async function getXmtpDisappearingMessageSettings(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const settings = await wrapXmtpCallWithDuration("getDisappearingMessageSettings", async () => {
      return disappearingMessageSettings(client.installationId, xmtpConversationId)
    })

    return settings || null
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get disappearing message settings for conversation: ${xmtpConversationId}`,
    })
  }
}

/**
 * Check if disappearing messages are enabled for a conversation
 */
export async function isXmtpDisappearingMessagesEnabled(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    return wrapXmtpCallWithDuration("isDisappearingMessagesEnabled", async () => {
      return isDisappearingMessagesEnabled(client.installationId, xmtpConversationId)
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to check if disappearing messages are enabled for conversation: ${xmtpConversationId}`,
    })
  }
}

/**
 * Update the disappearing message settings for a conversation
 */
export async function updateXmtpDisappearingMessageSettings(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  retentionDurationInNs: number
}) {
  const { clientInboxId, xmtpConversationId, retentionDurationInNs } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("updateDisappearingMessageSettings", async () => {
      return updateDisappearingMessageSettings(
        client.installationId,
        xmtpConversationId,
        getTodayNs(),
        retentionDurationInNs,
      )
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to update disappearing message settings for conversation: ${xmtpConversationId}`,
    })
  }
}

export async function clearXmtpDisappearingMessageSettings(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("clearDisappearingMessageSettings", async () => {
      return clearDisappearingMessageSettings(client.installationId, xmtpConversationId)
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to clear disappearing message settings for conversation: ${xmtpConversationId}`,
    })
  }
}
