import { useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { deleteConversationMetadata } from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import { updateConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { ensureDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

export const useDeleteConversationsMutation = () => {
  return useMutation({
    mutationFn: async (conversationIds: IXmtpConversationId[]) => {
      const currentSender = getSafeCurrentSender()
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      await Promise.all(
        conversationIds.map((conversationId) =>
          deleteConversationMetadata({
            deviceIdentityId: deviceIdentity.id,
            xmtpConversationId: conversationId,
          }),
        ),
      )
    },
    onMutate: async (conversationIds: IXmtpConversationId[]) => {
      const currentSender = getSafeCurrentSender()

      conversationIds.forEach((conversationId) => {
        updateConversationMetadataQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          updateData: {
            deleted: true,
          },
        })
      })
    },
    onError: (_, conversationIds: IXmtpConversationId[]) => {
      const currentSender = getSafeCurrentSender()

      conversationIds.forEach((conversationId) => {
        updateConversationMetadataQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          updateData: {
            deleted: false,
          },
        })
      })
    },
  })
}
