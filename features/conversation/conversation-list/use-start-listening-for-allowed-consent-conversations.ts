import { useEffect } from "react"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { getAllowedConsentConversationsQueryOptions } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { ensureConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { IConversationId } from "@/features/conversation/conversation.types"
import {
  getConversationQueryData,
  getConversationQueryOptions,
} from "@/features/conversation/queries/conversation.query"
import {
  subscribeToConversationsNotifications,
  unsubscribeFromConversationsNotifications,
} from "@/features/notifications/notifications-conversations-subscriptions"
import { addConversationNotificationMessageFromStorageInOurCache } from "@/features/notifications/notifications-storage"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"

export function useStartListeningForAllowedConsentConversations() {
  const senders = useMultiInboxStore((state) => state.senders)

  useEffect(() => {
    const observers = senders.map((sender) => {
      return createSenderAllowedConversationsObserver({
        inboxId: sender.inboxId,
      })
    })

    return () => {
      observers.forEach((observer) => {
        observer.unsubscribe()
      })
    }
  }, [senders])
}

function createSenderAllowedConversationsObserver(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  const conversationObservers = new Map<IConversationId, { unsubscribe: () => void }>()

  const allowedConversationsObserver = createQueryObserverWithPreviousData({
    queryOptions: getAllowedConsentConversationsQueryOptions({
      clientInboxId: inboxId,
    }),
    observerCallbackFn: (result) => {
      const previousConversationIds = result.previousData
      const currentConversationIds = result.data

      if (!currentConversationIds) {
        return
      }

      // 1. Sync notification messages from storage
      syncNotificationMessagesFromStorage({ conversationIds: currentConversationIds })

      // 2. Manage conversation observers (add new, remove old)
      updateConversationObservers({
        currentConversationIds,
        conversationObservers,
        inboxId,
      })

      // 3. Handle notification subscriptions and unsubscriptions
      handleNotificationUpdates({
        previousConversationIds,
        currentConversationIds,
        inboxId,
      })
    },
  })

  return {
    unsubscribe: () => {
      allowedConversationsObserver.unsubscribe()
      conversationObservers.forEach((observer) => observer.unsubscribe())
      conversationObservers.clear()
    },
  }
}

function syncNotificationMessagesFromStorage(args: { conversationIds: IConversationId[] }) {
  const { conversationIds } = args

  for (const conversationId of conversationIds) {
    addConversationNotificationMessageFromStorageInOurCache({
      conversationId,
    }).catch(captureError)
  }
}

function getActiveConversations(args: {
  conversationIds: IConversationId[]
  inboxId: IXmtpInboxId
}) {
  const { conversationIds, inboxId } = args

  return conversationIds.filter((id) => {
    const conversation = getConversationQueryData({
      clientInboxId: inboxId,
      xmtpConversationId: id,
    })
    return conversation?.isActive
  })
}

function updateConversationObservers(args: {
  currentConversationIds: IConversationId[]
  conversationObservers: Map<IConversationId, { unsubscribe: () => void }>
  inboxId: IXmtpInboxId
}) {
  const { currentConversationIds, conversationObservers, inboxId } = args

  const activeConversationIds = getActiveConversations({
    conversationIds: currentConversationIds,
    inboxId,
  })

  // Add observers for new conversations
  const newConversationIds = activeConversationIds.filter((id) => !conversationObservers.has(id))

  newConversationIds.forEach((conversationId) => {
    const observer = createConversationContentObserver({ inboxId, conversationId })
    conversationObservers.set(conversationId, observer)
  })

  // Remove observers for conversations no longer active
  const conversationsToRemove = Array.from(conversationObservers.keys()).filter(
    (id) => !activeConversationIds.includes(id),
  )

  conversationsToRemove.forEach((conversationId) => {
    const observer = conversationObservers.get(conversationId)
    if (observer) {
      observer.unsubscribe()
      conversationObservers.delete(conversationId)
    }
  })
}

function handleNotificationUpdates(args: {
  previousConversationIds?: IConversationId[]
  currentConversationIds: IConversationId[]
  inboxId: IXmtpInboxId
}) {
  const { previousConversationIds, currentConversationIds, inboxId } = args

  const activeConversationIds = getActiveConversations({
    conversationIds: currentConversationIds,
    inboxId,
  })

  // Subscribe to new active conversations
  const newActiveConversations = activeConversationIds.filter(
    (id) => !previousConversationIds || !previousConversationIds.includes(id),
  )

  if (newActiveConversations.length > 0) {
    subscribeToNewConversations({ conversationIds: newActiveConversations, inboxId })
  }

  // Unsubscribe from inactive conversations
  const inactiveConversations = currentConversationIds.filter((id) => {
    const conversation = getConversationQueryData({
      clientInboxId: inboxId,
      xmtpConversationId: id,
    })
    return conversation && !conversation.isActive
  })

  if (inactiveConversations.length > 0) {
    unsubscribeFromConversationsNotifications({
      conversationIds: inactiveConversations,
      clientInboxId: inboxId,
    }).catch(captureError)
  }

  // Unsubscribe from conversations removed from allowed list
  if (previousConversationIds) {
    const removedConversations = previousConversationIds.filter(
      (id) => !currentConversationIds.includes(id),
    )

    if (removedConversations.length > 0) {
      unsubscribeFromConversationsNotifications({
        conversationIds: removedConversations,
        clientInboxId: inboxId,
      }).catch(captureError)
    }
  }
}

function subscribeToNewConversations(args: {
  conversationIds: IConversationId[]
  inboxId: IXmtpInboxId
}) {
  const { conversationIds, inboxId } = args

  customPromiseAllSettled(
    conversationIds.map((id) =>
      ensureConversationMetadataQueryData({
        clientInboxId: inboxId,
        xmtpConversationId: id,
        caller: "useStartListeningForAllowedConsentConversations",
      }),
    ),
  )
    .then((results) => {
      const unmutedConversationIds = conversationIds.filter((id, index) => {
        const result = results[index]

        if (result.status === "rejected") {
          captureError(
            new GenericError({
              error: result.reason,
              additionalMessage: `Failed to ensure conversation metadata for conversation ${id}`,
            }),
          )
          return false
        }

        return !result.value?.muted
      })

      if (unmutedConversationIds.length > 0) {
        return subscribeToConversationsNotifications({
          conversationIds: unmutedConversationIds,
          clientInboxId: inboxId,
        })
      }
    })
    .catch(captureError)
}

function createConversationContentObserver(args: {
  inboxId: IXmtpInboxId
  conversationId: IConversationId
}) {
  const { inboxId, conversationId } = args

  return createQueryObserverWithPreviousData({
    queryOptions: getConversationQueryOptions({
      clientInboxId: inboxId,
      xmtpConversationId: conversationId,
      caller: "useStartListeningForAllowedConsentConversations",
    }),
    observerCallbackFn: (result) => {
      const previousConversation = result.previousData
      const currentConversation = result.data

      if (!currentConversation) {
        return
      }

      // If the conversation is no longer active, unsubscribe from notifications
      if (previousConversation?.isActive && !currentConversation.isActive) {
        unsubscribeFromConversationsNotifications({
          conversationIds: [conversationId],
          clientInboxId: inboxId,
        }).catch(captureError)
      }
    },
  })
}
