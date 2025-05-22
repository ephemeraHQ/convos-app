import { queryOptions, useQuery } from "@tanstack/react-query"
import { IGroupMember } from "@/features/groups/group.types"
import {
  IGroupMemberWithProfile,
  sortGroupMembers,
} from "@/features/groups/utils/sort-group-members"
import { ensureProfileQueryData } from "@/features/profiles/profiles.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { hash } from "@/utils/hash"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  members: IGroupMember[]
}

type IArgsWithCaller = IArgs & {
  caller: string
}

function getSortedGroupMembersQueryOptions(args: IArgsWithCaller) {
  const { clientInboxId, xmtpConversationId, members } = args

  const memberInboxIds = members.map((member) => member.inboxId)
  const membersHash = hash(memberInboxIds.join(","))

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "sortedGroupMembers",
      clientInboxId,
      xmtpConversationId,
      membersHash,
    }),
    enabled: !!members.length,
    queryFn: async () => {
      const profiles = await Promise.all(
        memberInboxIds.map((inboxId) =>
          ensureProfileQueryData({
            xmtpId: inboxId,
            caller: "getSortedGroupMembersQuery",
          }),
        ),
      )

      // Create member-profile pairs with proper profiles
      const memberProfilePairs = members.map((member) => {
        // Find the profile by matching member's inboxId
        const profileIndex = memberInboxIds.findIndex((id: string) => id === member.inboxId)
        // Ensure we have a proper profile object, even if data is missing
        const profile = profileIndex !== -1 ? profiles[profileIndex] : null
        return {
          ...member,
          profile: {
            name: profile?.name || "",
          },
        } as IGroupMemberWithProfile
      })

      // Use the enhanced sorting with profiles
      const sorted = sortGroupMembers(memberProfilePairs)

      // Return sorted inbox IDs
      return sorted.map((member) => member.inboxId)
    },
  })
}

export function useSortedGroupMembers(args: IArgsWithCaller) {
  return useQuery(getSortedGroupMembersQueryOptions(args))
}
