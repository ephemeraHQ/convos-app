import { useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { deleteConversationMetadata } from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import { updateConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { ensureDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import {
  setXmtpConsentStateForInboxId,
  updateXmtpConsentForGroupsForInbox,
} from "@/features/xmtp/xmtp-consent/xmtp-consent"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

export const useDeleteConversationsMutation = () => {
  return useMutation({
    mutationFn: async (conversationIds: IXmtpConversationId[]) => {
      const currentSender = getSafeCurrentSender()
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      await Promise.all([
        // There's a good chance that if we delete we also want to deny the conversation
        updateXmtpConsentForGroupsForInbox({
          clientInboxId: currentSender.inboxId,
          groupIds: conversationIds,
          consent: "denied",
        }),
        // Also deny the user if the conversation is a DM
        ...conversationIds.map((conversationId) => {
          const conversation = getConversationQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: conversationIds[0],
          })

          if (!conversation || isConversationGroup(conversation)) {
            return Promise.resolve()
          }

          return setXmtpConsentStateForInboxId({
            peerInboxId: conversation.peerInboxId,
            consent: "denied",
            clientInboxId: currentSender.inboxId,
          })
        }),
        ...conversationIds.map((conversationId) =>
          deleteConversationMetadata({
            deviceIdentityId: deviceIdentity.id,
            xmtpConversationId: conversationId,
          }),
        ),
      ])
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
