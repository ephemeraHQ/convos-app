import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useMutation } from "@tanstack/react-query"
import {
  getGroupQueryData,
  invalidateGroupQuery,
  setGroupQueryData,
  useGroupQuery,
} from "@/features/groups/queries/group.query"
import { invalidateGroupPermissionsQuery } from "@/features/groups/queries/group-permissions.query"
import { addAdminToXmtpGroup } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"

export const usePromoteToAdminMutation = (args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) => {
  const { clientInboxId, xmtpConversationId } = args

  const { data: group } = useGroupQuery({ clientInboxId: clientInboxId, xmtpConversationId })

  return useMutation({
    mutationFn: async (inboxId: IXmtpInboxId) => {
      if (!group) {
        throw new Error("No group found to promote member to admin")
      }
      await addAdminToXmtpGroup({
        clientInboxId,
        groupId: group.xmtpId,
        adminInboxId: inboxId,
      })
      return inboxId
    },
    onMutate: async (inboxId: IXmtpInboxId) => {
      if (!xmtpConversationId) {
        return
      }

      // No need to cancel query as we're updating the group directly

      const previousGroup = getGroupQueryData({
        clientInboxId,
        xmtpConversationId,
      })
      if (!previousGroup) {
        return
      }

      // Create a new group object with the updated member permission
      const updatedGroup = {
        ...previousGroup,
        members: {
          ...previousGroup.members,
          byId: {
            ...previousGroup.members.byId,
            [inboxId]: {
              ...previousGroup.members.byId[inboxId],
              permission: "admin",
            },
          },
        },
      }

      // Update the group data
      setGroupQueryData({
        clientInboxId,
        xmtpConversationId,
        group: updatedGroup,
      })

      return { previousGroup }
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousGroup || !xmtpConversationId) {
        return
      }

      // Restore the previous group data
      setGroupQueryData({
        clientInboxId,
        xmtpConversationId,
        group: context.previousGroup,
      })
    },
    onSuccess: () => {
      // Invalidate both group and permissions queries to ensure UI reflects latest data
      invalidateGroupQuery({ clientInboxId, xmtpConversationId })
      invalidateGroupPermissionsQuery({ 
        clientInboxId, 
        xmtpConversationId, 
        caller: "promoteToAdminMutation" 
      })
    },
  })
}
