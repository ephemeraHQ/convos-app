import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import {
  ensureAllowedConsentConversationsQueryData,
  getAllowedConsentConversationsQueryObserver,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { getNotificationsPermissionsQueryConfig } from "@/features/notifications/notifications-permissions.query"
import { userHasGrantedNotificationsPermissions } from "@/features/notifications/notifications.service"
import { getXmtpConversationHmacKeys } from "@/features/xmtp/xmtp-hmac-keys/xmtp-hmac-keys"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"
import {
  subscribeToNotificationTopicsWithMetadata,
  unsubscribeFromNotificationTopics,
} from "./notifications.api"

// Global map to track observers by inbox ID
const allowedConversationsObserversMap = new Map<
  IXmtpInboxId,
  ReturnType<typeof getAllowedConsentConversationsQueryObserver>
>()

// Global variable to track previous senders
let previousSendersInboxIds: IXmtpInboxId[] = []

// Store unsubscribe functions
let notificationsPermissionsUnsubscribe: (() => void) | null = null
let inboxStoreUnsubscribe: (() => void) | null = null

export async function setupConversationsNotificationsSubscriptions() {
  // cleanupSubscriptions()

  // Set up subscription for notifications permissions changes
  const permissionsObserver = createQueryObserverWithPreviousData({
    queryOptions: getNotificationsPermissionsQueryConfig(),
    observerCallbackFn: async ({ data, previousData }) => {
      if (!data) {
        return
      }

      const isNewPermissionStatus = data.status !== previousData?.status

      if (!isNewPermissionStatus) {
        return
      }

      if (data.status === "granted") {
        // Permission granted
        const currentSenders = useMultiInboxStore.getState().senders
        const inboxIds = currentSenders.map((sender) => sender.inboxId)
        for (const inboxId of inboxIds) {
          await setupAllowedConversationObserverForInbox(inboxId)
        }
      } else {
        // Permission revoked or not granted
        await unsubscribeAllConversationsNotifications()
      }
    },
  })

  notificationsPermissionsUnsubscribe = permissionsObserver.unsubscribe

  // Set up subscription for multi-inbox store changes
  inboxStoreUnsubscribe = useMultiInboxStore.subscribe(
    (state) => state.senders,
    async (senders, previousSenders) => {
      if (senders.length === previousSenders.length) {
        return
      }

      const hasPushNotificationPermissions = await userHasGrantedNotificationsPermissions()
      if (!hasPushNotificationPermissions) {
        return
      }

      const currentInboxIds = senders.map((sender) => sender.inboxId)
      const previousInboxIds = previousSendersInboxIds

      // Find inbox IDs to unsubscribe (present in previous but not in current)
      const inboxIdsToUnsubscribe = previousInboxIds.filter((id) => !currentInboxIds.includes(id))

      // Find inbox IDs to subscribe (present in current but not in previous)
      const inboxIdsToSubscribe = currentInboxIds.filter((id) => !previousInboxIds.includes(id))

      // Handle unsubscriptions
      if (inboxIdsToUnsubscribe.length > 0) {
        await unsubscribeConversationsForInboxes(inboxIdsToUnsubscribe)
      }

      // Handle subscriptions
      for (const inboxId of inboxIdsToSubscribe) {
        await setupAllowedConversationObserverForInbox(inboxId)
      }

      // Update our tracking of previous senders
      previousSendersInboxIds = [...currentInboxIds]
    },
    {
      fireImmediately: true,
    },
  )
}

// function cleanupSubscriptions() {
//   notificationsLogger.debug("Cleaned up notifications subscriptions and observers")

//   // Unsubscribe from notifications permissions observer
//   if (notificationsPermissionsUnsubscribe) {
//     notificationsPermissionsUnsubscribe()
//     notificationsPermissionsUnsubscribe = null
//   }

//   // Unsubscribe from multi-inbox store
//   if (inboxStoreUnsubscribe) {
//     inboxStoreUnsubscribe()
//     inboxStoreUnsubscribe = null
//   }

//   // Clean up all conversation observers
//   allowedConversationsObserversMap.forEach((observer) => {
//     observer.destroy()
//   })
//   allowedConversationsObserversMap.clear()

//   // Reset previous senders
//   previousSendersInboxIds = []
// }

/**
 * Removes observers and unsubscribes for multiple inbox IDs
 */
async function unsubscribeConversationsForInboxes(inboxIds: IXmtpInboxId[]) {
  notificationsLogger.debug(`Removing observers for ${inboxIds.length} inboxes`)

  for (const inboxId of inboxIds) {
    const observer = allowedConversationsObserversMap.get(inboxId)
    if (observer) {
      observer.destroy()
      allowedConversationsObserversMap.delete(inboxId)
    }
  }
}

/**
 * Sets up a query observer for a each client inbox ID
 */
function setupAllowedConversationObserverForInbox(clientInboxId: IXmtpInboxId) {
  if (allowedConversationsObserversMap.has(clientInboxId)) {
    return
  }

  // Store conversation IDs for comparison
  let previousConversationIds: IXmtpConversationId[] = []

  // Create observer for the inbox
  const observer = getAllowedConsentConversationsQueryObserver({ clientInboxId })

  // Set up subscription for query changes
  observer.subscribe((query) => {
    if (!query.data) {
      return
    }

    const validConversationsIds = query.data.filter((id) => !isTmpConversation(id))

    // Find conversations to unsubscribe from
    const conversationsToUnsubscribe = previousConversationIds.filter(
      (id) => !validConversationsIds.includes(id),
    )

    // Find conversations to subscribe to
    const conversationsToSubscribe = validConversationsIds.filter(
      (id) => !previousConversationIds.includes(id),
    )

    // Handle unsubscriptions
    if (conversationsToUnsubscribe.length > 0) {
      unsubscribeFromConversationsNotifications({
        conversationIds: conversationsToUnsubscribe,
        clientInboxId,
      }).catch(captureError)
    }

    // Handle new subscriptions
    if (conversationsToSubscribe.length > 0) {
      subscribeToConversationsNotifications({
        conversationIds: conversationsToSubscribe,
        clientInboxId,
      }).catch(captureError)
    }

    // Update previous conversation IDs for next comparison
    previousConversationIds = validConversationsIds
  })

  // Store the observer in our map for tracking
  allowedConversationsObserversMap.set(clientInboxId, observer)

  notificationsLogger.debug(`New allowed conversation observer setup for ${clientInboxId}`)
}

async function unsubscribeAllConversationsNotifications() {
  notificationsLogger.debug("Notifications not granted, clearing observers and unsubscribing")

  const senders = useMultiInboxStore.getState().senders

  await Promise.all(
    senders.map(async (sender) => {
      const conversationIds = await ensureAllowedConsentConversationsQueryData({
        clientInboxId: sender.inboxId,
        caller: "unsubscribeAllConversationsNotifications",
      })

      await unsubscribeFromConversationsNotifications({
        conversationIds,
        clientInboxId: sender.inboxId,
      })
    }),
  )

  previousSendersInboxIds = []

  allowedConversationsObserversMap.forEach((observer) => {
    observer.destroy()
  })
  allowedConversationsObserversMap.clear()

  notificationsLogger.debug("Unsubscribed from all conversations notifications")
}

async function subscribeToConversationsNotifications(args: {
  conversationIds: IXmtpConversationId[]
  clientInboxId: IXmtpInboxId
}) {
  const { conversationIds, clientInboxId } = args

  notificationsLogger.debug(`Subscribing to ${conversationIds.length} conversations...`)

  try {
    // Get installation ID once for all conversations
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

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

          const hmacKeys = await getXmtpConversationHmacKeys({
            clientInboxId,
            conversationId,
          })

          return {
            topic: hmacKeys.topic,
            isSilent: true,
            hmacKeys: hmacKeys.hmacKeys,
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

async function unsubscribeFromConversationsNotifications(args: {
  conversationIds: IXmtpConversationId[]
  clientInboxId: IXmtpInboxId
}) {
  const { conversationIds, clientInboxId } = args

  notificationsLogger.debug(`Unsubscribing from ${conversationIds.length} conversations`)

  try {
    // Get installation ID once for all conversations
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    // Collect topics for all conversations
    const topicsData = await Promise.all(
      conversationIds.map(async (conversationId) => {
        try {
          const conversation = await ensureConversationQueryData({
            clientInboxId,
            xmtpConversationId: conversationId,
            caller: "unsubscribeFromConversationsNotifications",
          })

          if (!conversation) {
            throw new Error(`Conversation not found: ${conversationId}`)
          }

          const hmacKeys = await getXmtpConversationHmacKeys({
            clientInboxId,
            conversationId,
          })

          return hmacKeys.topic
        } catch (error) {
          captureError(
            new NotificationError({
              error,
              additionalMessage: `Failed to get topic for conversation ${conversationId}`,
            }),
          )
          return null
        }
      }),
    )

    // Filter out nulls
    const validTopics = topicsData.filter(Boolean)

    if (validTopics.length === 0) {
      notificationsLogger.debug("No valid topics to unsubscribe from")
      return
    }

    // Make a single API call to unsubscribe from all topics
    await unsubscribeFromNotificationTopics({
      installationId,
      topics: validTopics,
    })

    notificationsLogger.debug(
      `Successfully unsubscribed from ${validTopics.length} conversations in batch`,
    )
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: `Failed to unsubscribe from conversations batch for inbox ${clientInboxId}`,
      }),
    )
  }
}
