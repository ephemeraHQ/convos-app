import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import {
  ensureAllowedConsentConversationsQueryData,
  getAllowedConsentConversationsQueryObserver,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { getNotificationsPermissionsQueryConfig } from "@/features/notifications/notifications-permissions.query"
import { userHasGrantedNotificationsPermissions } from "@/features/notifications/notifications.service"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { getXmtpHmacKeysForConversation } from "@/features/xmtp/xmtp-hmac-keys/xmtp-hmac-keys"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"
import {
  subscribeToNotificationTopicsWithMetadata,
  unsubscribeFromNotificationTopics,
} from "./notifications.api"

const allowedConversationsObserversMap = new Map<
  IXmtpInboxId,
  ReturnType<typeof getAllowedConsentConversationsQueryObserver>
>()

let isSubscribedToMultiInboxStore = false
let isSubscribedToNotificationsPermissions = false
let isSubscribedToAuthenticationStore = false

export async function setupConversationsNotificationsSubscriptions() {
  if (isSubscribedToAuthenticationStore) {
    return
  }

  useAuthenticationStore.subscribe(
    (state) => state.status,
    async (status, previousStatus) => {
      if (status === previousStatus) {
        return
      }

      if (status === "signedIn") {
        // User just signed in, set up other subscriptions
        await setupNotificationsPermissionsListener()
        await setupMultiInboxListener()

        const currentSenders = useMultiInboxStore.getState().senders
        const inboxIds = currentSenders.map((sender) => sender.inboxId)
        for (const inboxId of inboxIds) {
          // Create conversations observer
          await setupAllowedConversationsObserverForInbox(inboxId)
          const conversationIds = await ensureAllowedConsentConversationsQueryData({
            clientInboxId: inboxId,
            caller: "setupConversationsNotificationsSubscriptions",
          })

          // Subscribe to conversations
          await subscribeToConversationsNotifications({
            conversationIds,
            clientInboxId: inboxId,
          })
        }
      } else if (previousStatus === "signedIn") {
        const currentSenders = useMultiInboxStore.getState().senders
        const inboxIds = currentSenders.map((sender) => sender.inboxId)

        // User just signed out, clean up
        for (const inboxId of inboxIds) {
          await unsubscribeFromConversationsNotificationsForInbox(inboxId)
          removeConversationsObserver(inboxId)
        }
      }
    },
    {
      fireImmediately: true,
    },
  )

  isSubscribedToAuthenticationStore = true
}

async function setupNotificationsPermissionsListener() {
  if (isSubscribedToNotificationsPermissions) {
    return
  }

  createQueryObserverWithPreviousData({
    queryOptions: getNotificationsPermissionsQueryConfig(),
    observerCallbackFn: async ({ data, previousData }) => {
      if (!data) {
        return
      }

      const isNewPermissionStatus = data.status !== previousData?.status
      if (!isNewPermissionStatus) {
        return
      }

      const isUserSignedIn = useAuthenticationStore.getState().status === "signedIn"
      if (!isUserSignedIn) {
        return
      }

      const currentSenders = useMultiInboxStore.getState().senders
      const inboxIds = currentSenders.map((sender) => sender.inboxId)

      if (data.status === "granted") {
        // Permission granted
        for (const inboxId of inboxIds) {
          await setupAllowedConversationsObserverForInbox(inboxId)
        }
      } else {
        // Permission revoked or not granted
        for (const inboxId of inboxIds) {
          await unsubscribeFromConversationsNotificationsForInbox(inboxId)
          removeConversationsObserver(inboxId)
        }
      }
    },
  })

  notificationsLogger.debug(
    "Subscribed to notifications permissions to subscribe/unsubscribe to conversations",
  )
  isSubscribedToNotificationsPermissions = true
}

async function setupMultiInboxListener() {
  if (isSubscribedToMultiInboxStore) {
    return
  }

  useMultiInboxStore.subscribe(
    (state) => state.senders,
    async (senders, previousSenders) => {
      if (senders.length === previousSenders.length) {
        return
      }

      const isUserSignedIn = useAuthenticationStore.getState().status === "signedIn"
      if (!isUserSignedIn) {
        return
      }

      const hasPushNotificationPermissions = await userHasGrantedNotificationsPermissions()
      if (!hasPushNotificationPermissions) {
        return
      }

      const currentInboxIds = senders.map((sender) => sender.inboxId)
      const previousInboxIds = previousSenders.map((sender) => sender.inboxId)

      const inboxIdsToUnsubscribe = previousInboxIds.filter((id) => !currentInboxIds.includes(id))
      const inboxIdsToSubscribe = currentInboxIds.filter((id) => !previousInboxIds.includes(id))

      if (inboxIdsToUnsubscribe.length > 0) {
        for (const inboxId of inboxIdsToUnsubscribe) {
          await unsubscribeFromConversationsNotificationsForInbox(inboxId)
          removeConversationsObserver(inboxId)
        }
      }

      for (const inboxId of inboxIdsToSubscribe) {
        await setupAllowedConversationsObserverForInbox(inboxId)
      }
    },
  )

  notificationsLogger.debug(
    "Subscribed to multi inbox store to subscribe/unsubscribe to conversations",
  )
  isSubscribedToMultiInboxStore = true
}

async function unsubscribeFromConversationsNotificationsForInbox(inboxId: IXmtpInboxId) {
  const conversationIds = await ensureAllowedConsentConversationsQueryData({
    clientInboxId: inboxId,
    caller: "removeSenderListeners",
  })
  unsubscribeFromConversationsNotifications({
    conversationIds,
    clientInboxId: inboxId,
  })
}

function removeConversationsObserver(inboxId: IXmtpInboxId) {
  const observer = allowedConversationsObserversMap.get(inboxId)
  if (observer) {
    observer.destroy()
    allowedConversationsObserversMap.delete(inboxId)
  }
}

/**
 * Sets up a query observer for a each client inbox ID
 */
function setupAllowedConversationsObserverForInbox(inboxId: IXmtpInboxId) {
  if (allowedConversationsObserversMap.has(inboxId)) {
    return
  }

  // Store conversation IDs for comparison
  let previousConversationIds: IXmtpConversationId[] = []

  // Create observer for the inbox
  const observer = getAllowedConsentConversationsQueryObserver({ clientInboxId: inboxId })

  // Set up subscription for query changes
  observer.subscribe((query) => {
    if (!query.data) {
      return
    }

    const isUserSignedIn = useAuthenticationStore.getState().status === "signedIn"
    if (!isUserSignedIn) {
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
        clientInboxId: inboxId,
      }).catch(captureError)
    }

    // Handle new subscriptions
    if (conversationsToSubscribe.length > 0) {
      subscribeToConversationsNotifications({
        conversationIds: conversationsToSubscribe,
        clientInboxId: inboxId,
      }).catch(captureError)
    }

    // Update previous conversation IDs for next comparison
    previousConversationIds = validConversationsIds
  })

  // Store the observer in our map for tracking
  allowedConversationsObserversMap.set(inboxId, observer)

  notificationsLogger.debug(`New allowed conversation observer setup for ${inboxId}`)
}

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

    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const conversationTopics = await Promise.all(
      conversationIds.map(async (id) => {
        const conversation = await ensureConversationQueryData({
          clientInboxId,
          xmtpConversationId: id,
          caller: "unsubscribeFromConversationsNotifications",
        })
        return conversation?.xmtpTopic
      }),
    )

    if (conversationTopics.length === 0) {
      return
    }

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
