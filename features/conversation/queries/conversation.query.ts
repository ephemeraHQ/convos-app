import type { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { Query, queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { ensureConversationSyncAllQuery } from "@/features/conversation/queries/conversation-sync-all.query"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { getXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { Optional } from "@/types/general"
import { updateObjectAndMethods } from "@/utils/update-object-and-methods"
import { reactQueryClient } from "../../../utils/react-query/react-query.client"

export type IConversationQueryData = Awaited<ReturnType<typeof getConversation>>

type IGetConversationArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

type IGetConversationArgsWithCaller = IGetConversationArgs & { caller: string }

async function getConversation(args: IGetConversationArgs) {
  const { clientInboxId, xmtpConversationId } = args

  if (!xmtpConversationId) {
    throw new Error("Xmtp conversation ID is required")
  }

  if (!clientInboxId) {
    throw new Error("Inbox ID is required")
  }

  // Let's make sure we have this query done otherwise it doesn't make sense to do "syncOneXmtpConversation"
  await ensureConversationSyncAllQuery({
    clientInboxId,
  })

  await syncOneXmtpConversation({
    clientInboxId,
    conversationId: xmtpConversationId,
  })

  const xmtpConversation = await getXmtpConversation({
    clientInboxId,
    conversationId: xmtpConversationId,
  })

  if (!xmtpConversation) {
    throw new Error("XMTP Conversation not found")
  }

  const convosConversation = await convertXmtpConversationToConvosConversation(xmtpConversation)

  return convosConversation
}

export const useConversationQuery = (args: IGetConversationArgsWithCaller) => {
  return useQuery(getConversationQueryOptions(args))
}

export function getConversationQueryOptions(
  args: Optional<IGetConversationArgsWithCaller, "caller">,
) {
  const { clientInboxId, xmtpConversationId, caller } = args
  const enabled = !!xmtpConversationId && !!clientInboxId && !isTmpConversation(xmtpConversationId)
  return queryOptions({
    meta: {
      caller,
      persist: (query: Query) => {
        const conversation = query.state.data as IConversationQueryData | undefined
        if (!conversation) {
          return true
        }
        return !isTmpConversation(conversation.xmtpId)
      },
    },
    queryKey: ["conversation", clientInboxId, xmtpConversationId],
    queryFn: enabled ? () => getConversation({ clientInboxId, xmtpConversationId }) : skipToken,
    enabled,
  })
}

export const setConversationQueryData = (
  args: IGetConversationArgs & {
    conversation: IConversationQueryData | undefined
  },
) => {
  const { clientInboxId, xmtpConversationId, conversation } = args
  reactQueryClient.setQueryData(
    getConversationQueryOptions({
      clientInboxId,
      xmtpConversationId,
    }).queryKey,
    (previousConversation) => {
      if (!previousConversation) {
        return conversation
      }

      if (!conversation) {
        return undefined
      }

      // Keep existing lastMessage if new conversation has undefined lastMessage
      const lastMessage =
        conversation.lastMessage === undefined
          ? previousConversation.lastMessage
          : conversation.lastMessage

      return {
        ...previousConversation,
        ...conversation,
        lastMessage,
      }
    },
  )
}

export function updateConversationQueryData(
  args: IGetConversationArgs & {
    conversationUpdate: Partial<IConversationQueryData>
  },
) {
  const { conversationUpdate } = args
  reactQueryClient.setQueryData(
    getConversationQueryOptions(args).queryKey,
    (previousConversation) => {
      if (!previousConversation) {
        return undefined
      }
      return updateObjectAndMethods(previousConversation, conversationUpdate)
    },
  )
}

export const getConversationQueryData = (args: IGetConversationArgs) => {
  return reactQueryClient.getQueryData(getConversationQueryOptions(args).queryKey)
}

export function ensureConversationQueryData(args: IGetConversationArgsWithCaller) {
  return reactQueryClient.ensureQueryData(getConversationQueryOptions(args))
}

export function invalidateConversationQuery(args: IGetConversationArgs) {
  return reactQueryClient.invalidateQueries(getConversationQueryOptions(args))
}
