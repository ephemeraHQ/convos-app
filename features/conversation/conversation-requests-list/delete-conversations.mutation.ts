import { useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { executeUpdateConsentForInboxIdMutation } from "@/features/consent/update-consent-for-inbox-id.mutation"
import { deleteConversationMetadata } from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import { updateConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { ensureDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import { updateXmtpConsentForConversationForInbox } from "@/features/xmtp/xmtp-consent/xmtp-consent"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type IDeleteConversationsMutationArgs = {
  conversationIds: IXmtpConversationId[]
  alsoDenyInviterConsent: boolean
}

export const useDeleteConversationsMutation = () => {
  return useMutation({
    mutationFn: async (args: IDeleteConversationsMutationArgs) => {
      const { conversationIds, alsoDenyInviterConsent } = args
      const currentSender = getSafeCurrentSender()
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      const promises = []

      // if (alsoDenyInviterConsent) {
      //   // Also deny the user that invited them
      //   promises.push(
      //     ...conversationIds.map((conversationId) => {
      //       const conversation = getConversationQueryData({
      //         clientInboxId: currentSender.inboxId,
      //         xmtpConversationId: conversationId,
      //       })

      //       if (!conversation) {
      //         throw new Error("Conversation not found while denying inviter consent")
      //       }

      //       if (isConversationGroup(conversation)) {
      //         return executeUpdateConsentForInboxIdMutation({
      //           peerInboxId: conversation.addedByInboxId,
      //           consent: "denied",
      //           clientInboxId: currentSender.inboxId,
      //         })
      //       } else {
      //         return executeUpdateConsentForInboxIdMutation({
      //           peerInboxId: conversation.peerInboxId,
      //           consent: "denied",
      //           clientInboxId: currentSender.inboxId,
      //         })
      //       }
      //     }),
      //   )
      // }

      // // Deny the conversation content to not stream any more messages from it
      // promises.push(
      //   updateXmtpConsentForConversationForInbox({
      //     clientInboxId: currentSender.inboxId,
      //     conversationIds: conversationIds,
      //     consent: "denied",
      //   }),
      // )

      // Delete the conversations
      promises.push(
        ...conversationIds.map((conversationId) =>
          deleteConversationMetadata({
            deviceIdentityId: deviceIdentity.id,
            xmtpConversationId: conversationId,
          }),
        ),
      )

      await Promise.all(promises)
    },
    onMutate: async (args: IDeleteConversationsMutationArgs) => {
      const { conversationIds } = args
      const currentSender = getSafeCurrentSender()

      // Update the conversation metadata to be deleted
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
    onError: (_, args: IDeleteConversationsMutationArgs) => {
      const { conversationIds } = args
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
