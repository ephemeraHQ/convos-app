import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  IConversationMetadata,
  muteConversationMetadata,
} from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import {
  getConversationMetadataQueryData,
  updateConversationMetadataQueryData,
} from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { ensureDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import { unsubscribeFromConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type MuteConversationContext = {
  previousData: IConversationMetadata | undefined
}

function getMuteConversationMutationOptions(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}): MutationOptions<void, Error, void, MuteConversationContext> {
  const { xmtpConversationId, caller } = args
  const currentSender = getSafeCurrentSender()

  return {
    meta: { caller },
    mutationKey: ["mute-conversation", xmtpConversationId, currentSender.inboxId],
    mutationFn: async () => {
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      await muteConversationMetadata({
        deviceIdentityId: deviceIdentity.id,
        xmtpConversationId,
      })

      await unsubscribeFromConversationsNotifications({
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
          muted: true,
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

export function useMuteConversationMutation(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  return useMutation(getMuteConversationMutationOptions(args))
}
