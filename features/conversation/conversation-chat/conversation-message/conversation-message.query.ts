import { Query, queryOptions, useQuery } from "@tanstack/react-query"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { messageIsRecent } from "@/features/conversation/conversation-chat/conversation-message/utils/message-is-recent"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { getXmtpConversationMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { mergeObjDeep } from "@/utils/objects"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { TimeUtils } from "@/utils/time.utils"
import { convertXmtpMessageToConvosMessage } from "./utils/convert-xmtp-message-to-convos-message"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId | undefined
  xmtpConversationId?: IXmtpConversationId // Not passing undefined will not sync the conversation
}

type IConversationMessageQueryData = Awaited<ReturnType<typeof getConversationMessage>>

async function getConversationMessage(args: IArgs) {
  const { clientInboxId, xmtpMessageId, xmtpConversationId: xmtpConversationIdArg } = args

  if (!xmtpMessageId) {
    throw new Error("xmtpMessageId is required")
  }

  let xmtpConversationId = xmtpConversationIdArg

  if (!xmtpConversationId) {
    // Check if we already have the message in the cache and have the conversation associated
    const message = getConversationMessageQueryData({
      clientInboxId,
      xmtpMessageId,
    })

    if (message) {
      xmtpConversationId = message.xmtpConversationId
    }
  }

  if (xmtpConversationIdArg) {
    await syncOneXmtpConversation({
      clientInboxId,
      conversationId: xmtpConversationIdArg,
      caller: "getConversationMessage",
    })
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

export function getConversationMessageQueryOptions(
  args: IArgs & {
    caller?: string
  },
) {
  const { clientInboxId, xmtpMessageId, xmtpConversationId, caller } = args
  return queryOptions({
    meta: {
      caller,
      persist: (query: Query<IConversationMessageQueryData>) => {
        if (!query.state.data) {
          return false
        }
        return messageIsRecent(query.state.data)
      },
    },
    queryKey: getReactQueryKey({
      baseStr: "conversation-message",
      clientInboxId,
      xmtpMessageId,
      xmtpConversationId,
    }),
    queryFn: () => getConversationMessage({ clientInboxId, xmtpMessageId, xmtpConversationId }),
    enabled: !!xmtpMessageId && !!clientInboxId,
    refetchOnMount: false, // Because we prefer setting the message query data from when we fetch list of messages
    refetchOnWindowFocus: false, // Because we prefer setting the message query data from when we fetch list of messages
    refetchOnReconnect: false, // Because we prefer setting the message query data from when we fetch list of messages
    staleTime: Infinity, // Because we prefer setting the message query data from when we fetch list of messages
    gcTime: TimeUtils.days(30).toMilliseconds(),
  })
}

export function useConversationMessageQuery(
  args: IArgs & {
    caller: string
  },
) {
  return useQuery(getConversationMessageQueryOptions(args))
}

export function setConversationMessageQueryData(
  args: IArgs & {
    message: IConversationMessageQueryData
  },
) {
  const { clientInboxId, xmtpMessageId, xmtpConversationId, message } = args
  return reactQueryClient.setQueryData(
    getConversationMessageQueryOptions({
      clientInboxId,
      xmtpMessageId,
      xmtpConversationId,
    }).queryKey,
    message,
  )
}

export function ensureConversationMessageQueryData(
  args: IArgs & {
    caller: string
  },
) {
  return reactQueryClient.ensureQueryData(getConversationMessageQueryOptions(args))
}

export function updateConversationMessageQueryData(
  args: IArgs & {
    messageUpdate: Partial<IConversationMessage>
  },
) {
  const { clientInboxId, xmtpMessageId, xmtpConversationId, messageUpdate } = args

  const currentMessage = reactQueryClient.getQueryData<IConversationMessage>(
    getConversationMessageQueryOptions({ clientInboxId, xmtpMessageId, xmtpConversationId })
      .queryKey,
  )

  if (!currentMessage) {
    return
  }

  const updatedMessage = mergeObjDeep(currentMessage, messageUpdate)

  setConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId,
    xmtpConversationId,
    message: updatedMessage,
  })

  return updatedMessage
}

export function getConversationMessageQueryData(args: IArgs) {
  return reactQueryClient.getQueryData(getConversationMessageQueryOptions(args).queryKey)
}

export function invalidateConversationMessageQuery(args: IArgs) {
  return reactQueryClient.invalidateQueries({
    queryKey: getConversationMessageQueryOptions(args).queryKey,
  })
}

export function refetchConversationMessageQuery(args: IArgs) {
  return reactQueryClient.refetchQueries({
    queryKey: getConversationMessageQueryOptions(args).queryKey,
  })
}
