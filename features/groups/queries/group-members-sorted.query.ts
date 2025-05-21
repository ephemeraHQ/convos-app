import { queryOptions, useQuery } from "@tanstack/react-query"
import { ensureProfileQueryData } from "@/features/profiles/profiles.query"
import { sortGroupMembers, IGroupMemberWithProfile } from "@/features/groups/utils/sort-group-members"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { getOrFetchGroupQuery } from "./group.query"
import { IGroupMember } from "@/features/groups/group.types"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

type IArgsWithCaller = IArgs & {
  caller: string
}

export function getSortedGroupMembersQueryOptions(args: IArgsWithCaller) {
  const { clientInboxId, xmtpConversationId } = args

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "sortedGroupMembers",
      clientInboxId,
      xmtpConversationId,
    }),
    queryFn: async () => {
      const conversation = await getOrFetchGroupQuery({
        clientInboxId,
        xmtpConversationId,
        caller: "getSortedGroupMembersQuery",
      })
      
      // Ensure this is a group conversation
      if (!conversation || !isConversationGroup(conversation)) {
        return []
      }
      
      // At this point, TypeScript knows conversation is an IGroup
      if (!conversation.members?.ids?.length) {
        return []
      }

      // Get member inbox IDs
      const memberInboxIds = conversation.members.ids.map((id) => conversation.members.byId[id as IXmtpInboxId].inboxId)
      
      // Load all profiles
      const profiles = await Promise.all(
        memberInboxIds.map((inboxId) => 
          ensureProfileQueryData({ 
            xmtpId: inboxId as IXmtpInboxId, 
            caller: "getSortedGroupMembersQuery" 
          })
        )
      )
      
      // Create member-profile pairs with proper profiles
      const memberProfilePairs = Object.values(conversation.members.byId).map((member: IGroupMember) => {
        // Find the profile by matching member's inboxId
        const profileIndex = memberInboxIds.findIndex((id: string) => id === member.inboxId)
        // Ensure we have a proper profile object, even if data is missing
        const profile = profileIndex !== -1 ? profiles[profileIndex] : null
        return { 
          ...member,
          profile: {
            name: profile?.name || ""
          }
        } as IGroupMemberWithProfile
      })
      
      // Use the enhanced sorting with profiles
      const sorted = sortGroupMembers(memberProfilePairs)
      
      // Return sorted inbox IDs
      return sorted.map(member => member.inboxId)
    },
  })
}

export function useSortedGroupMembers(args: IArgsWithCaller) {
  return useQuery(getSortedGroupMembersQueryOptions(args))
}

export async function getSortedGroupMembersQueryData(args: IArgsWithCaller) {
  return reactQueryClient.ensureQueryData(getSortedGroupMembersQueryOptions(args))
}
