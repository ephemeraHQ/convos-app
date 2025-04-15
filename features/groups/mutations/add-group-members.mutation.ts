import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useMutation } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { refetchConversationMessagesInfiniteQuery } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { getGroupQueryData, setGroupQueryData } from "@/features/groups/queries/group.query"
import { addXmtpGroupMembers } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
import { captureError } from "@/utils/capture-error"
import { IGroup } from "../group.types"

type AddGroupMembersVariables = {
  group: IGroup
  inboxIds: IXmtpInboxId[]
}

export function useAddGroupMembersMutation() {
  const currentSender = useSafeCurrentSender()

  return useMutation({
    mutationFn: async (variables: AddGroupMembersVariables) => {
      const { group, inboxIds } = variables
      return addXmtpGroupMembers({
        clientInboxId: currentSender.inboxId,
        groupId: group.xmtpId,
        inboxIds,
      })
    },
    onMutate: async (variables: AddGroupMembersVariables) => {
      const { group, inboxIds } = variables

      // Get current group
      const previousGroup = getGroupQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: group.xmtpId,
      })

      if (!previousGroup) {
        return
      }

      // Create a new group object with the added members
      const updatedGroup = {
        ...previousGroup,
        members: {
          ...previousGroup.members,
          byId: { ...previousGroup.members.byId },
          ids: [...previousGroup.members.ids],
        },
      }

      // Add the new members
      for (const inboxId of inboxIds) {
        if (!updatedGroup.members.ids.includes(inboxId)) {
          updatedGroup.members.ids.push(inboxId)
        }

        updatedGroup.members.byId[inboxId] = {
          inboxId,
          permission: "member",
          consentState: "unknown",
        }
      }

      // Update the group data
      setGroupQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: group.xmtpId,
        group: updatedGroup,
      })

      return { previousGroup }
    },
    onSettled: (data, error, variables) => {
      // Let's make sure we are up to date
      refetchConversationMessagesInfiniteQuery({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: variables.group.xmtpId,
        caller: "add-group-members-mutation",
      }).catch(captureError)
    },
  })
}
