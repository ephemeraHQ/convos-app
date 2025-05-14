import { useMutation } from "@tanstack/react-query"
import { invalidateDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { updateXmtpDisappearingMessageSettings } from "@/features/xmtp/xmtp-disappearing-messages/xmtp-disappearing-messages"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export const useUpdateDisappearingMessageSettings = () => {
  return useMutation({
    mutationFn: async (args: {
      clientInboxId: IXmtpInboxId
      conversationId: IXmtpConversationId
      retentionDurationInNs: number
      clearChat?: boolean
    }) => {
      const { clientInboxId, conversationId, retentionDurationInNs, clearChat } = args

      return updateXmtpDisappearingMessageSettings({
        clientInboxId,
        conversationId,
        retentionDurationInNs,
        clearChat,
      })
    },
    onSettled: (data, error, variables) => {
      invalidateDisappearingMessageSettings({
        clientInboxId: variables.clientInboxId,
        conversationId: variables.conversationId,
        caller: "useUpdateDisappearingMessageSettings",
      })
    },
  })
}
