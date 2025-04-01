import { IXmtpInboxId, IXmtpMessageId } from "@features/xmtp/xmtp.types"
import { queryOptions } from "@tanstack/react-query"
import { isTmpMessageId } from "@/features/conversation/conversation-chat/conversation-message/utils/is-tmp-message"
import { getXmtpConversationMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { convertXmtpMessageToConvosMessage } from "./utils/convert-xmtp-message-to-convos-message"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId
}

async function getConversationMessage(args: IArgs) {
  const { clientInboxId, xmtpMessageId } = args

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
    queryKey: ["conversation-message", clientInboxId, xmtpMessageId],
    queryFn: () => getConversationMessage({ clientInboxId, xmtpMessageId }),
    enabled: !!xmtpMessageId && !!clientInboxId && !isTmpMessageId(xmtpMessageId),
  })
}
