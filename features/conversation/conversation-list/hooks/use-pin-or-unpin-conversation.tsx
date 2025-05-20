import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  pinConversationMetadata,
  unpinConversationMetadata,
} from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import {
  getConversationMetadataQueryData,
  updateConversationMetadataQueryData,
} from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { ensureDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

export function usePinOrUnpinConversation(args: { xmtpConversationId: IXmtpConversationId }) {
  const { xmtpConversationId } = args

  const { mutateAsync: pinConversationAsync } = useMutation({
    mutationFn: async () => {
      const currentSender = getSafeCurrentSender()
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      return pinConversationMetadata({
        deviceIdentityId: deviceIdentity.id,
        xmtpConversationId: xmtpConversationId,
      })
    },
    onMutate: () => {
      const currentSender = getSafeCurrentSender()

      const previousPinned = getConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: xmtpConversationId,
      })?.pinned

      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: xmtpConversationId,
        updateData: { pinned: true },
      })

      return { previousPinned }
    },
    onError: (__, _, context) => {
      const currentSender = getSafeCurrentSender()

      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: xmtpConversationId,
        updateData: { pinned: context?.previousPinned },
      })
    },
  })

  const { mutateAsync: unpinConversationAsync } = useMutation({
    mutationFn: async () => {
      const currentSender = getSafeCurrentSender()
      const deviceIdentity = await ensureDeviceIdentityForInboxId(currentSender.inboxId)

      return unpinConversationMetadata({
        deviceIdentityId: deviceIdentity.id,
        xmtpConversationId: xmtpConversationId,
      })
    },
    onMutate: () => {
      const currentSender = getSafeCurrentSender()

      const previousPinned = getConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: xmtpConversationId,
      })?.pinned

      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: xmtpConversationId,
        updateData: { pinned: false },
      })

      return { previousPinned }
    },
    onError: (__, _, context) => {
      const currentSender = getSafeCurrentSender()

      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: xmtpConversationId,
        updateData: { pinned: context?.previousPinned },
      })
    },
  })

  const pinOrUnpinConversationAsync = useCallback(async () => {
    const currentSender = getSafeCurrentSender()

    const isPinned = getConversationMetadataQueryData({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId: xmtpConversationId,
    })?.pinned

    if (isPinned) {
      return unpinConversationAsync()
    } else {
      return pinConversationAsync()
    }
  }, [xmtpConversationId, pinConversationAsync, unpinConversationAsync])

  return {
    pinOrUnpinConversationAsync,
  }
}
