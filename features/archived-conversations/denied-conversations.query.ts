import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken } from "@tanstack/react-query"
import { setConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import { getXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-list"
import { syncAllXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

export type IDeniedConversationsQueryData = Awaited<
  ReturnType<typeof getDeniedConversationsQueryFn>
>

async function getDeniedConversationsQueryFn(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  if (!inboxId) {
    throw new Error("InboxId is required")
  }

  await syncAllXmtpConversations({
    clientInboxId: inboxId,
    caller: "getDeniedConversationsQueryFn",
    consentStates: ["denied"],
  })

  const deniedConsentXmtpConversations = await getXmtpConversations({
    clientInboxId: inboxId,
    consentStates: ["denied"],
    caller: "getDeniedConversationsQueryFn",
  })

  const convosConversations = await Promise.all(
    deniedConsentXmtpConversations.map(convertXmtpConversationToConvosConversation),
  )

  for (const conversation of convosConversations) {
    setConversationQueryData({
      clientInboxId: inboxId,
      xmtpConversationId: conversation.xmtpId,
      conversation,
    })
  }

  return convosConversations.map((c) => c.xmtpId)
}

export const getDeniedConsentConversationsQueryData = (args: { inboxId: IXmtpInboxId }) => {
  return reactQueryClient.getQueryData(getDeniedConsentConversationsQueryOptions(args).queryKey)
}

export function addConversationToDeniedConsentConversationsQuery(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  return reactQueryClient.setQueryData(
    getDeniedConsentConversationsQueryOptions({
      inboxId: clientInboxId,
      caller: "addConversationToDeniedConsentConversationsQuery",
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

export function removeConversationFromDeniedConsentConversationsQuery(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  return reactQueryClient.setQueryData(
    getDeniedConsentConversationsQueryOptions({
      inboxId: clientInboxId,
      caller: "removeConversationFromDeniedConsentConversationsQuery",
    }).queryKey,
    (previousConversationIds) => {
      if (!previousConversationIds) {
        return []
      }

      return previousConversationIds.filter((id) => id !== conversationId)
    },
  )
}

export function getDeniedConsentConversationsQueryOptions(args: {
  inboxId: IXmtpInboxId
  caller?: string
}) {
  const { inboxId, caller } = args

  const enabled = !!inboxId

  return queryOptions({
    enabled,
    meta: {
      caller,
    },
    queryKey: ["denied-consent-conversations", inboxId],
    queryFn: enabled
      ? async () =>
          getDeniedConversationsQueryFn({
            inboxId,
          })
      : skipToken,
  })
}

export function invalidateDeniedConsentConversationsQuery(args: {
  inboxId: IXmtpInboxId
  caller: string
}) {
  const { inboxId, caller } = args
  return reactQueryClient.invalidateQueries({
    queryKey: getDeniedConsentConversationsQueryOptions({
      inboxId,
      caller,
    }).queryKey,
  })
}

export function refetchDeniedConsentConversationsQuery(args: {
  inboxId: IXmtpInboxId
  caller: string
}) {
  const { inboxId, caller } = args
  return reactQueryClient.refetchQueries({
    queryKey: getDeniedConsentConversationsQueryOptions({
      inboxId,
      caller,
    }).queryKey,
  })
}
