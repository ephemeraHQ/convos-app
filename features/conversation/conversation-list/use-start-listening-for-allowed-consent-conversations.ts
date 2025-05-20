import { useEffect } from "react"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { getAllowedConsentConversationsQueryOptions } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import {
  subscribeToConversationsNotifications,
  unsubscribeFromConversationsNotifications,
} from "@/features/notifications/notifications-conversations-subscriptions"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
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

  return createQueryObserverWithPreviousData({
    queryOptions: getAllowedConsentConversationsQueryOptions({
      clientInboxId: inboxId,
    }),
    observerCallbackFn: (result) => {
      const previousConversationIds = result.previousData
      const currentConversationIds = result.data

      if (!currentConversationIds) {
        return
      }

      const conversationIdsToSubscribe = currentConversationIds.filter(
        (id) => !previousConversationIds || !previousConversationIds.includes(id),
      )

      // Subscribe to notifications for new allowed conversations
      if (conversationIdsToSubscribe.length > 0) {
        subscribeToConversationsNotifications({
          conversationIds: conversationIdsToSubscribe,
          clientInboxId: inboxId,
        }).catch(captureError)
      }

      // Unsubscribe from notifications for conversations that are no longer allowed
      if (previousConversationIds) {
        const conversationIdsToUnsubscribe = previousConversationIds.filter(
          (id) => !currentConversationIds.includes(id),
        )

        if (conversationIdsToUnsubscribe.length > 0) {
          unsubscribeFromConversationsNotifications({
            conversationIds: conversationIdsToUnsubscribe,
            clientInboxId: inboxId,
          }).catch(captureError)
        }
      }
    },
  })
}
