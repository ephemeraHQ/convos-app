import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { QueryObserver, queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { setConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import {
  subscribeToConversationsNotifications,
  unsubscribeFromConversationsNotifications,
} from "@/features/notifications/notifications-conversations-subscriptions"
import { getXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-list"
import { syncAllXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { Optional } from "@/types/general"
import { captureError } from "@/utils/capture-error"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"
import { TimeUtils } from "@/utils/time.utils"
import { reactQueryClient } from "../../../utils/react-query/react-query.client"

export type IAllowedConsentConversationsQuery = Awaited<
  ReturnType<typeof getAllowedConsentConversationsQueryFn>
>

type IArgs = {
  clientInboxId: IXmtpInboxId
}

type IArgsWithCaller = IArgs & { caller: string }

export const createAllowedConsentConversationsQueryObserver = (
  args: IArgs & { caller: string },
) => {
  return new QueryObserver(reactQueryClient, getAllowedConsentConversationsQueryOptions(args))
}

export const useAllowedConsentConversationsQuery = (args: IArgs & { caller: string }) => {
  return useQuery(getAllowedConsentConversationsQueryOptions(args))
}

export const getAllowedConsentConversationsQueryData = (args: IArgs) => {
  return reactQueryClient.getQueryData(getAllowedConsentConversationsQueryOptions(args).queryKey)
}

export const getAllowedConsentConversationsQueryOptions = (
  args: Optional<IArgsWithCaller, "caller">,
) => {
  const { clientInboxId, caller } = args
  const enabled = !!clientInboxId
  return queryOptions({
    meta: {
      caller,
      persist: true,
    },
    queryKey: ["allowed-consent-conversations", clientInboxId],
    queryFn: enabled ? () => getAllowedConsentConversationsQueryFn({ clientInboxId }) : skipToken,
    enabled,
    staleTime: TimeUtils.days(30).toMilliseconds(), // Updated via stream or manually when user give consent so we don't need lots of refresh
    gcTime: TimeUtils.days(30).toMilliseconds(), // Updated via stream or manually when user give consent so we don't need lots of refresh
  })
}

export function getAllowedConsentConversationsQueryObserver(args: IArgs) {
  return new QueryObserver(reactQueryClient, getAllowedConsentConversationsQueryOptions(args))
}

export function fetchAllowedConsentConversationsQuery(args: IArgsWithCaller) {
  return reactQueryClient.fetchQuery(getAllowedConsentConversationsQueryOptions(args))
}

export function invalidateAllowedConsentConversationsQuery(args: IArgs) {
  return reactQueryClient.invalidateQueries(getAllowedConsentConversationsQueryOptions(args))
}

export function ensureAllowedConsentConversationsQueryData(args: IArgsWithCaller) {
  return reactQueryClient.ensureQueryData(getAllowedConsentConversationsQueryOptions(args))
}

export function addConversationToAllowedConsentConversationsQuery(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  return reactQueryClient.setQueryData(
    getAllowedConsentConversationsQueryOptions({
      clientInboxId,
      caller: "addConversationToAllowedConsentConversationsQuery",
    }).queryKey,
    (previousConversationIds) => {
      if (!previousConversationIds) {
        return [conversationId]
      }

      const conversationExists = previousConversationIds.includes(conversationId)

      if (conversationExists) {
        return previousConversationIds
      }

      return [conversationId, ...previousConversationIds]
    },
  )
}

export function removeConversationFromAllowedConsentConversationsQuery(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  return reactQueryClient.setQueryData(
    getAllowedConsentConversationsQueryOptions({
      clientInboxId,
      caller: "removeConversationFromAllowedConsentConversationsQuery",
    }).queryKey,
    (previousConversationIds) => {
      if (!previousConversationIds) {
        return []
      }

      return previousConversationIds.filter((id) => id !== conversationId)
    },
  )
}

async function getAllowedConsentConversationsQueryFn(args: IArgs) {
  const { clientInboxId } = args

  await syncAllXmtpConversations({
    clientInboxId,
    caller: "getAllowedConsentConversationsQueryFn",
  })

  const xmtpConversations = await getXmtpConversations({
    clientInboxId,
    consentStates: ["allowed"],
    caller: "getAllowedConsentConversationsQueryFn",
  })

  const convosConversations = await Promise.all(
    xmtpConversations.map(convertXmtpConversationToConvosConversation),
  )

  for (const convoConversation of convosConversations) {
    setConversationQueryData({
      clientInboxId,
      xmtpConversationId: convoConversation.xmtpId,
      conversation: convoConversation,
    })
  }

  return convosConversations.map((c) => c.xmtpId)
}

export function useStartListeningForAllowedConsentConversationsQuery() {
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
