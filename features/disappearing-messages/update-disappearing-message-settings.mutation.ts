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
      setTimestampToClearChat?: boolean
    }) => {
      const { clientInboxId, conversationId, retentionDurationInNs, setTimestampToClearChat } = args

      return updateXmtpDisappearingMessageSettings({
        clientInboxId,
        conversationId,
        retentionDurationInNs,
        setTimestampToClearChat,
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
