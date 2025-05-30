import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  IConversationMetadata,
  unmuteConversationMetadata,
} from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import {
  getConversationMetadataQueryData,
  updateConversationMetadataQueryData,
} from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { ensureDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import { subscribeToConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type UnmuteConversationContext = {
  previousData: IConversationMetadata | undefined
}

function getUnmuteConversationMutationOptions(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}): MutationOptions<void, Error, void, UnmuteConversationContext> {
  const { xmtpConversationId, caller } = args
  const currentSender = getSafeCurrentSender()

  return {
    meta: { caller },
    mutationKey: ["unmute-conversation", xmtpConversationId, currentSender.inboxId],
    mutationFn: async () => {
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      await unmuteConversationMetadata({
        deviceIdentityId: deviceIdentity.id,
        xmtpConversationId,
      })

      await subscribeToConversationsNotifications({
        conversationIds: [xmtpConversationId],
        clientInboxId: currentSender.inboxId,
      })
    },
    onMutate: () => {
      const previousData = getConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        updateData: {
          muted: false,
        },
      })

      return { previousData }
    },
    onError: (_, __, context) => {
      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        updateData: context?.previousData ?? {},
      })
    },
  }
}

export function useUnmuteConversationMutation(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  return useMutation(getUnmuteConversationMutationOptions(args))
}
