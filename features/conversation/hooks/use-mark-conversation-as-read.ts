import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  IConversationMetadata,
  markConversationMetadataAsRead,
} from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import {
  getConversationMetadataQueryData,
  updateConversationMetadataQueryData,
} from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getDeviceIdentityForInboxId } from "@/features/convos-identities/convos-identities.service"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { formatDateForApi } from "@/utils/convos-api/convos-api.utils"

// Define the type for the mutation context
type MarkAsReadContext = {
  previousData: IConversationMetadata | undefined
}

export function getMarkConversationAsReadMutationOptions(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}): MutationOptions<void, Error, void, MarkAsReadContext> {
  const { xmtpConversationId, caller } = args

  const currentSender = getSafeCurrentSender()
  const deviceIdentity = getDeviceIdentityForInboxId(currentSender.inboxId)

  if (!deviceIdentity) {
    throw new Error(
      `No device identity found for inbox id: ${currentSender.inboxId} in getMarkConversationAsReadMutationOptions (${caller})`,
    )
  }

  return {
    meta: {
      caller,
    },
    mutationKey: ["markConversationAsRead", xmtpConversationId],
    mutationFn: async () => {
      const readUntil = formatDateForApi(new Date())

      await markConversationMetadataAsRead({
        deviceIdentityId: deviceIdentity.id,
        xmtpConversationId,
        readUntil,
      })
    },
    onMutate: () => {
      const readUntil = formatDateForApi(new Date())
      const previousData = getConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        updateData: {
          readUntil,
          unread: false,
        },
      })

      return {
        previousData,
      }
    },
    onError: (error, _, context) => {
      updateConversationMetadataQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        updateData: context?.previousData ?? {},
      })
    },
  }
}

export function useMarkConversationAsReadMutation(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  return useMutation(getMarkConversationAsReadMutationOptions(args))
}
