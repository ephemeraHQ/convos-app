import { useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { deleteConversationMetadata } from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

export const useDeleteAllRequests = () => {
  return useMutation({
    mutationFn: async (args: { conversationIds: IXmtpConversationId[] }) => {
      const { conversationIds } = args

      const currentSender = getSafeCurrentSender()

      await Promise.all(
        conversationIds.map((conversationId) =>
          deleteConversationMetadata({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: conversationId,
          }),
        ),
      )

      return { count: conversationIds.length }
    },
  })
}
