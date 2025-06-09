import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { QueryObserver, queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { setConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import { getXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-list"
import { syncAllXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { Optional } from "@/types/general"
import { reactQueryLongCacheQueryOptions } from "@/utils/react-query/react-query.constants"
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
    ...reactQueryLongCacheQueryOptions, // Updated via stream or manually when user give consent so we don't need lots of refresh
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

  const xmtpAllowedConversations = await getXmtpConversations({
    clientInboxId,
    consentStates: ["allowed"],
    caller: "getAllowedConsentConversationsQueryFn",
  })

  const convosConversations = await Promise.all(
    xmtpAllowedConversations.map(convertXmtpConversationToConvosConversation),
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
