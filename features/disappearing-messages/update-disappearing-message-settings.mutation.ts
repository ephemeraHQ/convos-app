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
    }) => {
      const { clientInboxId, conversationId, retentionDurationInNs } = args

      return updateXmtpDisappearingMessageSettings({
        clientInboxId,
        conversationId,
        retentionDurationInNs,
      })
    },
    onSettled: (data, error, variables) => {
      console.log("goo")
      invalidateDisappearingMessageSettings({
        clientInboxId: variables.clientInboxId,
        conversationId: variables.conversationId,
        caller: "useUpdateDisappearingMessageSettings",
      })
    },
  })
}
