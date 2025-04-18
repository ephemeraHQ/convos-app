import { queryOptions, useQuery } from "@tanstack/react-query"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { getXmtpConversationMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { queryLogger } from "@/utils/logger/logger"
import { mergeObjDeep } from "@/utils/objects"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { convertXmtpMessageToConvosMessage } from "./utils/convert-xmtp-message-to-convos-message"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId | undefined
}

type IConversationMessageQueryData = Awaited<ReturnType<typeof getConversationMessage>>

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
    queryFn: () => getConversationMessage({ clientInboxId, xmtpMessageId }),
    enabled: !!xmtpMessageId && !!clientInboxId,
    refetchOnMount: false, // Because we prefer setting the message query data from when we fetch list of messages
    refetchOnWindowFocus: false, // Because we prefer setting the message query data from when we fetch list of messages
    refetchOnReconnect: false, // Because we prefer setting the message query data from when we fetch list of messages
    staleTime: Infinity, // Because we prefer setting the message query data from when we fetch list of messages
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
  const { clientInboxId, xmtpMessageId, message } = args
  queryLogger.debug(`Setting conversation message query data for ${xmtpMessageId}`, message)
  return reactQueryClient.setQueryData(
    getConversationMessageQueryOptions({
      clientInboxId,
      xmtpMessageId,
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

  setConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId,
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
