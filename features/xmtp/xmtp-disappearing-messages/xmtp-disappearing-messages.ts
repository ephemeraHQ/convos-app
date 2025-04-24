import {
  clearDisappearingMessageSettings,
  disappearingMessageSettings,
  isDisappearingMessagesEnabled,
  updateDisappearingMessageSettings,
} from "@xmtp/react-native-sdk"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
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
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const settings = await wrapXmtpCallWithDuration("getDisappearingMessageSettings", async () => {
      return disappearingMessageSettings(installationId, conversationId)
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
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    return wrapXmtpCallWithDuration("isDisappearingMessagesEnabled", async () => {
      return isDisappearingMessagesEnabled(installationId, conversationId)
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
}) {
  const { clientInboxId, conversationId, retentionDurationInNs } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("updateDisappearingMessageSettings", async () => {
      return updateDisappearingMessageSettings(
        installationId,
        conversationId,
        getTodayNs(),
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
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("clearDisappearingMessageSettings", async () => {
      return clearDisappearingMessageSettings(installationId, conversationId)
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to clear disappearing message settings for conversation: ${conversationId}`,
    })
  }
}
