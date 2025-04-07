import { queryOptions, useQuery } from "@tanstack/react-query"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { isTmpMessageId } from "@/features/conversation/conversation-chat/conversation-message/utils/is-tmp-message"
import { getXmtpConversationMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { mergeObjDeep } from "@/utils/objects"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { IMessageReactions, useMessageReactions } from "./conversation-message-reaction.query"
import { convertXmtpMessageToConvosMessage } from "./utils/convert-xmtp-message-to-convos-message"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId | undefined
}

// Extended message with reactions data
export type IMessageWithReactions = {
  message: IConversationMessage
  reactions: IMessageReactions
}

async function getConversationMessage(args: IArgs) {
  const { clientInboxId, xmtpMessageId } = args

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
}

export function getConversationMessageQueryOptions(args: IArgs) {
  const { clientInboxId, xmtpMessageId } = args
  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "conversation-message",
      clientInboxId,
      xmtpMessageId,
    }),
    queryFn: () => getConversationMessage({ clientInboxId, xmtpMessageId }),
    enabled: !!xmtpMessageId && !!clientInboxId && !isTmpMessageId(xmtpMessageId),
  })
}

// Main hook for fetching a message
export function useConversationMessageQuery(args: IArgs) {
  return useQuery(getConversationMessageQueryOptions(args))
}

export function useMessageWithReactions(args: IArgs) {
  const messageQuery = useConversationMessageQuery(args)
  const reactionsQuery = useMessageReactions(args)

  return {
    ...messageQuery,
    data: messageQuery.data
      ? {
          message: messageQuery.data,
          reactions: reactionsQuery.data || { bySender: {}, byReactionContent: {} },
        }
      : undefined,
    isLoading: messageQuery.isLoading || reactionsQuery.isLoading,
  }
}

export function setConversationMessageQueryData(args: IArgs, message: IConversationMessage) {
  return reactQueryClient.setQueryData(getConversationMessageQueryOptions(args).queryKey, message)
}

export function ensureConversationMessageQueryData(args: IArgs) {
  return reactQueryClient.ensureQueryData(getConversationMessageQueryOptions(args))
}

/**
 * Update a message in the cache
 */
export function updateMessageQueryData(args: {
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

/**
 * Replace a temporary message with a real message
 */
export function replaceMessageQueryData(args: {
  clientInboxId: IXmtpInboxId
  tmpXmtpMessageId: IXmtpMessageId
  realMessage: IConversationMessage
}) {
  const { clientInboxId, tmpXmtpMessageId, realMessage } = args

  // Remove the temp message query data
  reactQueryClient.removeQueries({
    queryKey: getConversationMessageQueryOptions({
      clientInboxId,
      xmtpMessageId: tmpXmtpMessageId,
    }).queryKey,
  })

  // Set the real message data
  setConversationMessageQueryData({ clientInboxId, xmtpMessageId: realMessage.xmtpId }, realMessage)
}

export function getConversationMessageQueryData(args: IArgs) {
  return reactQueryClient.getQueryData(getConversationMessageQueryOptions(args).queryKey)
}
