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
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const settings = await wrapXmtpCallWithDuration("getDisappearingMessageSettings", async () => {
      return disappearingMessageSettings(client.installationId, conversationId)
    })

    return settings || null
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get disappearing message settings for conversation: ${conversationId}`,
    })
  }
}

/**
 * Check if disappearing messages are enabled for a conversation
 */
export async function isXmtpDisappearingMessagesEnabled(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    return wrapXmtpCallWithDuration("isDisappearingMessagesEnabled", async () => {
      return isDisappearingMessagesEnabled(client.installationId, conversationId)
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to check if disappearing messages are enabled for conversation: ${conversationId}`,
    })
  }
}

/**
 * Update the disappearing message settings for a conversation
 */
export async function updateXmtpDisappearingMessageSettings(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
  retentionDurationInNs: number
  clearChat?: boolean
}) {
  const { clientInboxId, conversationId, retentionDurationInNs, clearChat } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("updateDisappearingMessageSettings", async () => {
      const timestamp = clearChat 
        ? 1 // Use 1 as timestamp (earliest possible timestamp) to clear all messages
        : getTodayNs()
      
      return updateDisappearingMessageSettings(
        client.installationId,
        conversationId,
        timestamp,
        retentionDurationInNs,
      )
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to update disappearing message settings for conversation: ${conversationId}`,
    })
  }
}

export async function clearXmtpDisappearingMessageSettings(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("clearDisappearingMessageSettings", async () => {
      return clearDisappearingMessageSettings(client.installationId, conversationId)
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to clear disappearing message settings for conversation: ${conversationId}`,
    })
  }
}
