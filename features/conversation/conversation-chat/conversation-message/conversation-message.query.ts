import { queryOptions, useQuery } from "@tanstack/react-query"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { isTmpMessageId } from "@/features/conversation/conversation-chat/conversation-message/utils/is-tmp-message"
import { getXmtpConversationMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { mergeObjDeep } from "@/utils/objects"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { convertXmtpMessageToConvosMessage } from "./utils/convert-xmtp-message-to-convos-message"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId | undefined
}

export function getConversationMessageQueryOptions(
  args: IArgs & {
    caller?: string
  },
) {
  const { clientInboxId, xmtpMessageId, caller } = args
  return queryOptions({
    meta: {
      caller,
    },
    queryKey: getReactQueryKey({
      baseStr: "conversation-message",
      clientInboxId,
      xmtpMessageId,
    }),
    queryFn: async () => {
      if (!xmtpMessageId) {
        throw new Error("xmtpMessageId is required")
      }

      const xmtpMessage = await getXmtpConversationMessage({
        messageId: xmtpMessageId,
        clientInboxId,
      })

      if (!xmtpMessage) {
        return null
      }

      return convertXmtpMessageToConvosMessage(xmtpMessage)
    },
    enabled: !!xmtpMessageId && !!clientInboxId && !isTmpMessageId(xmtpMessageId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  })
}

// Main hook for fetching a message
export function useConversationMessageQuery(
  args: IArgs & {
    caller: string
  },
) {
  return useQuery(getConversationMessageQueryOptions(args))
}

export function setConversationMessageQueryData(args: IArgs, message: IConversationMessage) {
  return reactQueryClient.setQueryData(getConversationMessageQueryOptions(args).queryKey, message)
}

export function ensureConversationMessageQueryData(
  args: IArgs & {
    caller: string
  },
) {
  return reactQueryClient.ensureQueryData(getConversationMessageQueryOptions(args))
}

/**
 * Update a message in the cache
 */
export function updateConversationMessageQueryData(args: {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId
  messageUpdate: Partial<IConversationMessage>
}) {
  const { clientInboxId, xmtpMessageId, messageUpdate } = args

  const currentMessage = reactQueryClient.getQueryData<IConversationMessage>(
    getConversationMessageQueryOptions({ clientInboxId, xmtpMessageId }).queryKey,
  )

  if (!currentMessage) {
    return
  }

  const updatedMessage = mergeObjDeep(currentMessage, messageUpdate)

  setConversationMessageQueryData({ clientInboxId, xmtpMessageId }, updatedMessage)

  return updatedMessage
}

export function getConversationMessageQueryData(args: IArgs) {
  return reactQueryClient.getQueryData(getConversationMessageQueryOptions(args).queryKey)
}

const optimisticMessageToRealMap = new Map<IXmtpMessageId, IXmtpMessageId>()

export function getRealMessageIdForOptimisticMessageId(optimisticMessageId: IXmtpMessageId) {
  return optimisticMessageToRealMap.get(optimisticMessageId)
}

export function setRealMessageIdForOptimisticMessageId(
  optimisticMessageId: IXmtpMessageId,
  realMessageId: IXmtpMessageId,
) {
  optimisticMessageToRealMap.set(optimisticMessageId, realMessageId)
}
