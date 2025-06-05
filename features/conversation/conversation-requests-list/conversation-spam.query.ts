import { queryOptions } from "@tanstack/react-query"
import { ensureMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { getMessageSpamScore } from "@/features/conversation/conversation-requests-list/utils/get-message-spam-score"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}

export function getConversationSpamQueryOptions(args: IArgs) {
  const { xmtpConversationId, clientInboxId } = args

  return queryOptions({
    enabled: !!xmtpConversationId && !!clientInboxId,
    queryKey: getReactQueryKey({
      baseStr: "is-spam",
      xmtpConversationId,
      clientInboxId,
    }),
    queryFn: async () => {
      return true
      const conversation = await ensureConversationQueryData({
        clientInboxId,
        xmtpConversationId,
        caller: "getConversationSpamQueryOptions",
      })

      if (!conversation) {
        throw new Error("Conversation not found")
      }

      // Check consent states based on conversation type
      if (isConversationGroup(conversation)) {
        const hasAllowedMember = Object.values(conversation.members.byId).some(
          (member) => member.consentState === "allowed",
        )
        if (hasAllowedMember) {
          return false
        }
      }

      const lastMessage = conversation.lastMessage

      if (!lastMessage) {
        return false
      }

      const messageText = await ensureMessageContentStringValue(lastMessage)

      if (!messageText) {
        throw new Error("No message text found")
      }

      const spamScore = await getMessageSpamScore({
        message: lastMessage,
      })

      const isSpam = spamScore !== 0

      return isSpam
    },
  })
}
