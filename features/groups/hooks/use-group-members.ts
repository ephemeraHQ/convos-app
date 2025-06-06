import { queryOptions, useQuery } from "@tanstack/react-query"
import { getGroupQueryOptions, setGroupQueryData } from "@/features/groups/queries/group.query"
import { convertXmtpGroupMemberToConvosMember } from "@/features/groups/utils/convert-xmtp-group-member-to-convos-member"
import { getXmtpGroupMembers } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
import { IXmtpConversationId, IXmtpGroupMember, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { entify } from "@/utils/entify"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

function getGroupMembersFallbackQueryOptions(args: {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
  caller: string
}) {
  const { xmtpConversationId, clientInboxId, caller } = args

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "groupMembersFallback",
      clientInboxId,
      xmtpConversationId,
    }),
    queryFn: async () => {
      const xmtpMembers = await getXmtpGroupMembers({
        clientInboxId,
        xmtpConversationId,
      })

      const groupMembers = xmtpMembers.map((xmtpMember: IXmtpGroupMember) =>
        convertXmtpGroupMemberToConvosMember(xmtpMember),
      )

      return entify(groupMembers, (member) => member.inboxId)
    },
    meta: {
      caller,
    },
  })
}

export function useGroupMembers(args: {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
  caller: string
  useFallback?: boolean
}) {
  const { xmtpConversationId, clientInboxId, caller, useFallback = true } = args

  const { data: group, isLoading: isLoadingGroup } = useQuery({
    ...getGroupQueryOptions({
      clientInboxId,
      xmtpConversationId,
      caller,
    }),
  })

  const shouldFetchFallback = Boolean(group && !group.members)

  const { data: fallbackMembers, isLoading: isLoadingFallback } = useQuery({
    ...getGroupMembersFallbackQueryOptions({
      xmtpConversationId,
      clientInboxId,
      caller: `${caller}-fallback`,
    }),
    enabled: shouldFetchFallback && useFallback,
  })

  // Update the group in cache when fallback members are fetched
  if (group && fallbackMembers && !group.members) {
    setGroupQueryData({
      clientInboxId,
      xmtpConversationId,
      group: {
        ...group,
        members: fallbackMembers,
      },
    })
  }

  const members = group?.members || fallbackMembers
  const isLoading = isLoadingGroup || (shouldFetchFallback && isLoadingFallback)

  return {
    members,
    isLoading,
  }
}
