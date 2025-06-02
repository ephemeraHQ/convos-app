import { useMutation } from "@tanstack/react-query"
import { invalidateDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { clearXmtpDisappearingMessageSettings } from "@/features/xmtp/xmtp-disappearing-messages/xmtp-disappearing-messages"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export const useClearDisappearingMessageSettings = () => {
  return useMutation({
    mutationFn: async (args: {
      clientInboxId: IXmtpInboxId
      conversationId: IXmtpConversationId
    }) => {
      const { clientInboxId, conversationId } = args

      return clearXmtpDisappearingMessageSettings({
        clientInboxId,
        xmtpConversationId: conversationId,
      })
    },
    onSettled: (data, error, variables) => {
      invalidateDisappearingMessageSettings({
        clientInboxId: variables.clientInboxId,
        xmtpConversationId: variables.conversationId,
        caller: "useClearDisappearingMessageSettings",
      })
    },
  })
}
