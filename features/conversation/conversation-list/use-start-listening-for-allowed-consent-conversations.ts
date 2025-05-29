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

  // Track conversation observers to clean them up
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

      // Put all the data we have in storage from our iOS NSE into our cache
      for (const conversationId of currentConversationIds) {
        addConversationNotificationMessageFromStorageInOurCache({
          conversationId,
        }).catch(captureError)
      }

      // Get active conversations from current IDs
      const activeConversationIds = currentConversationIds.filter((id) => {
        const conversation = getConversationQueryData({
          clientInboxId: inboxId,
          xmtpConversationId: id,
        })
        return conversation?.isActive
      })

      // Create observers for new conversations
      const newConversationIds = activeConversationIds.filter(
        (id) => !conversationObservers.has(id),
      )

      newConversationIds.forEach((conversationId) => {
        const conversationObserver = createConversationContentObserver({
          inboxId,
          conversationId,
        })
        conversationObservers.set(conversationId, conversationObserver)
      })

      // Clean up observers for conversations no longer in the list
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

      // Only subscribe to notifications for new active allowed conversations
      const conversationIdsToSubscribe = activeConversationIds.filter(
        (id) => !previousConversationIds || !previousConversationIds.includes(id),
      )

      if (conversationIdsToSubscribe.length > 0) {
        customPromiseAllSettled(
          conversationIdsToSubscribe.map((id) =>
            ensureConversationMetadataQueryData({
              clientInboxId: inboxId,
              xmtpConversationId: id,
              caller: "useStartListeningForAllowedConsentConversations",
            }),
          ),
        )
          .then((results) => {
            // Filter for successful metadata results that aren't muted
            const unmutedConversationIds = conversationIdsToSubscribe.filter((id, index) => {
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

      // Unsubscribe from notifications for conversations that are no longer active
      const inactiveCurrentConversations = currentConversationIds.filter((id) => {
        const conversation = getConversationQueryData({
          clientInboxId: inboxId,
          xmtpConversationId: id,
        })
        return conversation && !conversation.isActive
      })

      if (inactiveCurrentConversations.length > 0) {
        unsubscribeFromConversationsNotifications({
          conversationIds: inactiveCurrentConversations,
          clientInboxId: inboxId,
        }).catch(captureError)
      }

      // If we have previous conversations, unsubscribe from ones no longer in the allowed list
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
    },
  })

  return {
    unsubscribe: () => {
      allowedConversationsObserver.unsubscribe()
      // Clean up all conversation observers
      conversationObservers.forEach((observer) => {
        observer.unsubscribe()
      })
      conversationObservers.clear()
    },
  }
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
