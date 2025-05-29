import {
  ensureAllowedConsentConversationsQueryData,
  getAllowedConsentConversationsQueryData,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { ensureConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { getXmtpConversationTopicFromXmtpId } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { getXmtpHmacKeysForConversation } from "@/features/xmtp/xmtp-hmac-keys/xmtp-hmac-keys"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import {
  subscribeToNotificationTopicsWithMetadata,
  unsubscribeFromNotificationTopics,
} from "./notifications.api"

export async function subscribeToAllNonMutedAllowedConsentConversationsNotifications(args: {
  clientInboxId: IXmtpInboxId
}) {
  const { clientInboxId } = args

  const conversations = await ensureAllowedConsentConversationsQueryData({
    clientInboxId,
    caller: "subscribeToAllNonMutedAllowedConsentConversationsNotifications",
  })

  if (!conversations) {
    throw new Error("No allowed consent conversations found")
  }

  // Filter out muted conversations before subscribing
  const unmutedConversations = await Promise.all(
    conversations.map(async (conversationId) => {
      const metadata = await ensureConversationMetadataQueryData({
        xmtpConversationId: conversationId,
        clientInboxId,
        caller: "subscribeToAllNonMutedAllowedConsentConversationsNotifications",
      })

      // Only include conversations that aren't muted
      if (!metadata?.muted) {
        return conversationId
      }

      return null
    }),
  )

  // Remove null values and get final list of unmuted conversations
  const filteredConversationIds = unmutedConversations.filter(Boolean)

  await subscribeToConversationsNotifications({
    conversationIds: filteredConversationIds,
    clientInboxId,
  })
}

// Keep these functions outside the hook since they're used by the hook but don't directly use React features
export async function subscribeToConversationsNotifications(args: {
  conversationIds: IXmtpConversationId[]
  clientInboxId: IXmtpInboxId
}) {
  const { conversationIds, clientInboxId } = args

  notificationsLogger.debug(`Subscribing to ${conversationIds.length} conversations...`)

  try {
    // Collect subscription data for all conversations
    const subscriptionsData = await Promise.all(
      conversationIds.map(async (conversationId) => {
        try {
          const conversation = await ensureConversationQueryData({
            clientInboxId,
            xmtpConversationId: conversationId,
            caller: "subscribeToConversationsNotifications",
          })

          if (!conversation) {
            throw new Error(`Conversation not found: ${conversationId}`)
          }

          const conversationHmacKeys = await getXmtpHmacKeysForConversation({
            clientInboxId,
            conversationTopic: conversation.xmtpTopic,
          })

          return {
            topic: conversation.xmtpTopic,
            isSilent: false,
            hmacKeys: conversationHmacKeys.values.map((key) => ({
              thirtyDayPeriodsSinceEpoch: key.thirtyDayPeriodsSinceEpoch,
              key: Buffer.from(key.hmacKey).toString("hex"),
            })),
          }
        } catch (error) {
          captureError(
            new NotificationError({
              error,
              additionalMessage: `Failed to prepare subscription data for conversation ${conversationId}`,
            }),
          )
          return null
        }
      }),
    )

    // Filter out nulls
    const validSubscriptions = subscriptionsData.filter(Boolean)

    if (validSubscriptions.length === 0) {
      notificationsLogger.debug("No valid subscriptions to process")
      return
    }

    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    // Make a single API call with all subscriptions
    await subscribeToNotificationTopicsWithMetadata({
      installationId: client.installationId,
      subscriptions: validSubscriptions,
    })

    notificationsLogger.debug(
      `Successfully subscribed to ${validSubscriptions.length} conversations`,
    )
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: `Failed to subscribe to conversations batch for inbox ${clientInboxId}`,
      }),
    )
  }
}

export async function unsubscribeFromAllConversationsNotifications(args: {
  clientInboxId: IXmtpInboxId
}) {
  const { clientInboxId } = args

  notificationsLogger.debug(`Unsubscribing from all conversations for inbox ${clientInboxId}...`)

  const conversationIds = getAllowedConsentConversationsQueryData({
    clientInboxId,
  })

  if (!conversationIds || conversationIds.length === 0) {
    notificationsLogger.debug(`No conversations to unsubscribe from for inbox ${clientInboxId}`)
    return
  }

  await unsubscribeFromConversationsNotifications({
    conversationIds,
    clientInboxId,
  })
}

export async function unsubscribeFromConversationsNotifications(args: {
  conversationIds: IXmtpConversationId[]
  clientInboxId: IXmtpInboxId
}) {
  const { conversationIds, clientInboxId } = args

  if (conversationIds.length === 0) {
    return
  }

  try {
    notificationsLogger.debug(`Unsubscribing from ${conversationIds.length} conversations...`)

    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const conversationTopics = conversationIds.map(getXmtpConversationTopicFromXmtpId)

    // Make a single API call to unsubscribe from all topics
    await unsubscribeFromNotificationTopics({
      installationId: client.installationId,
      topics: conversationTopics,
    })

    notificationsLogger.debug(
      `Successfully unsubscribed from ${conversationTopics.length} conversations`,
    )
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: `Failed to unsubscribe from conversations for inbox ${clientInboxId}`,
      }),
    )
  }
}
