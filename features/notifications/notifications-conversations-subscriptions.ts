import { queryOptions, useQueries, useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import {
  getAllowedConsentConversationsQueryData,
  getAllowedConsentConversationsQueryOptions,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { getNotificationsPermissionsQueryConfig } from "@/features/notifications/notifications-permissions.query"
import { getXmtpConversationTopicFromXmtpId } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { getXmtpHmacKeysForConversation } from "@/features/xmtp/xmtp-hmac-keys/xmtp-hmac-keys"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { usePrevious } from "@/hooks/use-previous-value"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import {
  subscribeToNotificationTopicsWithMetadata,
  unsubscribeFromNotificationTopics,
} from "./notifications.api"

/**
 * React hook that manages conversation notifications subscriptions
 */
export function useConversationsNotificationsSubscriptions() {
  const authStatus = useAuthenticationStore((state) => state.status)
  const senders = useMultiInboxStore((state) => state.senders)

  const isSignedIn = authStatus === "signedIn"

  // Use react-query to directly get permissions
  const { data: hasNotificationPermission } = useQuery({
    ...getNotificationsPermissionsQueryConfig(),
    select: (data) => data.status === "granted",
  })
  const previousNotificationPermission = usePrevious(hasNotificationPermission)

  // Track previously subscribed conversations to detect changes
  const previousConversationsRef = useRef(new Map<IXmtpInboxId, IXmtpConversationId[]>())

  // Queries for all allowed conversations per inbox
  const senderWithConversationIdsMap = useQueries({
    queries: senders.map((sender) => {
      return queryOptions({
        ...getAllowedConsentConversationsQueryOptions({
          clientInboxId: sender.inboxId,
          caller: "useConversationsNotificationsSubscriptions",
        }),
        // Only enable when signed in and has notification permission
        enabled: isSignedIn && hasNotificationPermission,
        select: (data) => ({
          inboxId: sender.inboxId,
          conversationIds: data,
        }),
      })
    }),
    combine: (queries) => {
      return queries.reduce((acc, query) => {
        if (query.data) {
          acc.set(query.data.inboxId, query.data.conversationIds)
        }
        return acc
      }, new Map<IXmtpInboxId, IXmtpConversationId[]>())
    },
  })

  // Helper function for unsubscribing from all conversations
  async function unsubscribeFromAllConversations(
    conversationsMap?: Map<IXmtpInboxId, IXmtpConversationId[]>,
  ) {
    try {
      notificationsLogger.debug("Unsubscribing from all conversations...")

      // Use provided map or current ref
      const mapToUse = conversationsMap || previousConversationsRef.current

      // Unsubscribe from all conversations for all inboxes
      const unsubscribePromises = Array.from(mapToUse.entries()).map(
        async ([inboxId, conversationIds]) => {
          if (conversationIds.length > 0) {
            try {
              await unsubscribeFromConversationsNotifications({
                conversationIds,
                clientInboxId: inboxId,
              })

              notificationsLogger.debug(
                `Unsubscribed from ${conversationIds.length} conversations for inbox ${inboxId}`,
              )
            } catch (error) {
              captureError(
                new NotificationError({
                  error,
                  additionalMessage: `Failed to unsubscribe from conversations during cleanup for inbox ${inboxId}`,
                }),
              )
            }
          }
        },
      )

      // Wait for all unsubscribe operations to complete
      await Promise.all(unsubscribePromises)

      // Clear the reference if we're using the current ref (not a captured copy)
      if (!conversationsMap) {
        previousConversationsRef.current.clear()
      }

      notificationsLogger.debug("Unsubscribed from all conversations")
    } catch (error) {
      captureError(
        new NotificationError({
          error,
          additionalMessage: "Failed to unsubscribe from all conversations during cleanup",
        }),
      )
    }
  }

  // Main effect to handle subscriptions when queries data changes
  useEffect(() => {
    // Skip if not signed in or no permission
    if (!isSignedIn || !hasNotificationPermission) {
      return
    }

    async function manageSubscriptions() {
      // For each inbox/query result
      for (let i = 0; i < senders.length; i++) {
        const inboxId = senders[i].inboxId
        const conversationIds = senderWithConversationIdsMap.get(inboxId) || []

        // Get previously subscribed conversations for this inbox
        const previousConversations = previousConversationsRef.current.get(inboxId) || []

        // Find which conversations to subscribe/unsubscribe
        const conversationsToUnsubscribe = previousConversations.filter(
          (id) => !conversationIds.includes(id),
        )

        const conversationsToSubscribe = conversationIds.filter(
          (id) => !previousConversations.includes(id),
        )

        // Handle unsubscriptions
        if (conversationsToUnsubscribe.length > 0) {
          unsubscribeFromConversationsNotifications({
            conversationIds: conversationsToUnsubscribe,
            clientInboxId: inboxId,
          }).catch(captureError)
        }

        // Handle subscriptions
        if (conversationsToSubscribe.length > 0) {
          subscribeToConversationsNotifications({
            conversationIds: conversationsToSubscribe,
            clientInboxId: inboxId,
          }).catch(captureError)
        }

        // Update refs for next comparison
        previousConversationsRef.current.set(inboxId, conversationIds)
      }

      // Clean up any inboxes that are no longer in the list
      const currentInboxIds = senders.map((sender) => sender.inboxId)

      for (const [inboxId, conversationIds] of previousConversationsRef.current.entries()) {
        if (!currentInboxIds.includes(inboxId) && conversationIds.length > 0) {
          unsubscribeFromConversationsNotifications({
            conversationIds,
            clientInboxId: inboxId,
          }).catch(captureError)

          previousConversationsRef.current.delete(inboxId)
        }
      }
    }

    manageSubscriptions()
  }, [isSignedIn, hasNotificationPermission, senders, senderWithConversationIdsMap])

  useEffect(() => {
    // Had notif permission and remove it
    if (previousNotificationPermission && !hasNotificationPermission) {
      unsubscribeFromAllConversations()
    }
  }, [hasNotificationPermission, previousNotificationPermission])

  return null
}

// Keep these functions outside the hook since they're used by the hook but don't directly use React features
async function subscribeToConversationsNotifications(args: {
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
            isSilent: true,
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

    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    // Make a single API call with all subscriptions
    await subscribeToNotificationTopicsWithMetadata({
      installationId,
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

  const installationId = await ensureXmtpInstallationQueryData({
    inboxId: clientInboxId,
  })

  const conversationIds = getAllowedConsentConversationsQueryData({
    clientInboxId,
  })

  if (!conversationIds) {
    throw new Error(`No conversation ids found for inbox ${clientInboxId}`)
  }

  if (conversationIds.length > 0) {
    notificationsLogger.debug(`No conversations to unsubscribe from for inbox ${clientInboxId}`)
    return
  }

  const conversationTopics = conversationIds.map(getXmtpConversationTopicFromXmtpId)

  await unsubscribeFromNotificationTopics({
    installationId,
    topics: conversationTopics,
  })

  notificationsLogger.debug(
    `Successfully unsubscribed from ${conversationTopics.length} conversations for inbox ${clientInboxId}`,
  )
}

async function unsubscribeFromConversationsNotifications(args: {
  conversationIds: IXmtpConversationId[]
  clientInboxId: IXmtpInboxId
}) {
  const { conversationIds, clientInboxId } = args

  if (conversationIds.length === 0) {
    return
  }

  try {
    notificationsLogger.debug(`Unsubscribing from ${conversationIds.length} conversations...`)

    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const conversationTopics = conversationIds.map(getXmtpConversationTopicFromXmtpId)

    // Make a single API call to unsubscribe from all topics
    await unsubscribeFromNotificationTopics({
      installationId,
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
