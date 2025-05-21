import { queryOptions, useQuery } from "@tanstack/react-query"
import { ensureProfileQueryData } from "@/features/profiles/profiles.query"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { sortGroupMembers, IGroupMemberWithProfile } from "@/features/groups/utils/sort-group-members"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { getGroupQueryOptions } from "./group.query"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

type IArgsWithCaller = IArgs & {
  caller: string
}

export function getSortedGroupMembersQueryOptions(args: IArgsWithCaller) {
  const { clientInboxId, xmtpConversationId, caller } = args

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "sortedGroupMembers",
      clientInboxId,
      xmtpConversationId,
    }),
    queryFn: async () => {
      try {
        const members = await reactQueryClient.fetchQuery({
          queryKey: getReactQueryKey({
            baseStr: "group",
            clientInboxId, 
            xmtpConversationId,
            caller: `getSortedGroupMembersQuery:${caller}`,
          }),
          queryFn: async () => {
            const group = await reactQueryClient.fetchQuery(
              getGroupQueryOptions({
                clientInboxId,
                xmtpConversationId,
                caller: `getSortedGroupMembersQuery:${caller}`,
              })
            )
            return group?.members
          },
        })

        if (!members?.ids?.length) {
          return []
        }

        // Get member inbox IDs
        const memberInboxIds = members.ids.map(id => members.byId[id].inboxId)
        
        // Load all profiles
        const profiles = await Promise.all(
          memberInboxIds.map(inboxId => 
            ensureProfileQueryData({ 
              xmtpId: inboxId, 
              caller: `getSortedGroupMembersQuery:${caller}` 
            })
          )
        )
        
        // Create member-profile pairs for enhanced sorting
        const memberProfilePairs = Object.values(members.byId).map(member => {
          // Find the profile by matching member's inboxId
          const profileIndex = memberInboxIds.findIndex(id => id === member.inboxId)
          const profile = profileIndex !== -1 ? profiles[profileIndex] : null
          return { 
            ...member,
            profile
          } as IGroupMemberWithProfile
        })
        
        // Use the enhanced sorting with profiles
        const sorted = sortGroupMembers(memberProfilePairs)
        
        // Return sorted inbox IDs
        return sorted.map(member => member.inboxId)

      } catch (error) {
        captureError(new GenericError({
          error,
          additionalMessage: "Error loading sorted group members",
        }))
        
        // Return an empty array in case of error
        return []
      }
    },
  })
}

export function useSortedGroupMembers(args: IArgsWithCaller) {
  return useQuery(getSortedGroupMembersQueryOptions(args))
}

export async function getSortedGroupMembersQueryData(args: IArgsWithCaller) {
  return reactQueryClient.ensureQueryData(getSortedGroupMembersQueryOptions(args))
}

export function useGroupMembersWithSorting(args: IArgsWithCaller) {
  const { data: sortedMemberIds, isLoading: isLoadingSorted } = useSortedGroupMembers(args)
  const { members, isLoading: isLoadingMembers } = useGroupMembers(args)

  return {
    members,
    sortedMemberIds: sortedMemberIds || [],
    isLoading: isLoadingMembers || isLoadingSorted
  }
}
