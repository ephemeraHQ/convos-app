import type { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@features/xmtp/xmtp.types"
import { Query, queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { ensureConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { messageWasSentAfter } from "@/features/conversation/conversation-chat/conversation-message/utils/message-was-sent-after"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { getXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { Optional } from "@/types/general"
import { captureError } from "@/utils/capture-error"
import { ReactQueryError } from "@/utils/error"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
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

  await syncOneXmtpConversation({
    clientInboxId,
    conversationId: xmtpConversationId,
    caller: "getConversation",
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
    queryKey: getReactQueryKey({
      baseStr: "conversation",
      clientInboxId,
      xmtpConversationId,
    }),
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

      return {
        ...previousConversation,
        ...conversation,
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

export function ensureConversationQueryData(args: IGetConversationArgsWithCaller) {
  return reactQueryClient.ensureQueryData(getConversationQueryOptions(args))
}

export function invalidateConversationQuery(args: IGetConversationArgs) {
  return reactQueryClient.invalidateQueries(getConversationQueryOptions(args))
}

export function getConversationQueryData(args: IGetConversationArgs) {
  return reactQueryClient.getQueryData(getConversationQueryOptions(args).queryKey)
}

export async function maybeUpdateConversationQueryLastMessage(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  messageIds: IXmtpMessageId[]
}) {
  const { clientInboxId, xmtpConversationId, messageIds } = args

  try {
    const conversation = getConversationQueryData({
      clientInboxId,
      xmtpConversationId,
    })

    if (!conversation) {
      // If we don't even have the conversation, we can't update the last message
      return
    }

    const messages = await Promise.all(
      messageIds.map((messageId) =>
        ensureConversationMessageQueryData({
          clientInboxId,
          xmtpMessageId: messageId,
          xmtpConversationId,
          caller: "addMessagesToConversationMessagesInfiniteQueryData",
        }),
      ),
    )

    // Find the most recent message from the new messages
    let mostRecentMessage = messages.filter(Boolean).sort((a, b) => a.sentMs - b.sentMs)[0]

    // If we found a message and it's more recent than the conversation's current lastMessage
    if (
      mostRecentMessage &&
      (!conversation.lastMessage ||
        messageWasSentAfter(mostRecentMessage, conversation.lastMessage))
    ) {
      // Update the conversation with the new last message
      updateConversationQueryData({
        clientInboxId,
        xmtpConversationId,
        conversationUpdate: {
          lastMessage: mostRecentMessage,
        },
      })
    }
  } catch (error) {
    captureError(
      new ReactQueryError({
        error,
        additionalMessage: `Error updating conversation query last message with messages`,
      }),
    )
  }
}
