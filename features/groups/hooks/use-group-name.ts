import { queryOptions, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getGroupQueryOptions } from "@/features/groups/queries/group.query"
import { getPreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { usePreferredDisplayInfoBatch } from "@/features/preferred-display-info/use-preferred-display-info-batch"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export function getGroupNameForGroupMembers(args: { memberInboxIds: IXmtpInboxId[] }) {
  const { memberInboxIds } = args

  const groupName = getGroupNameForMemberNames({
    names: memberInboxIds.map(
      (inboxId) =>
        getPreferredDisplayInfo({
          inboxId,
        }).displayName ?? "",
    ),
  })

  return groupName
}

export const useGroupName = (args: { xmtpConversationId: IXmtpConversationId }) => {
  const { xmtpConversationId } = args

  const currentSenderInboxId = useSafeCurrentSender().inboxId

  const options = useMemo(() => {
    return queryOptions({
      ...getGroupQueryOptions({
        clientInboxId: currentSenderInboxId,
        xmtpConversationId,
        caller: "useGroupName",
      }),
      select: (data) => ({
        name: data?.name,
        memberIds: data?.members?.ids ?? [],
      }),
    })
  }, [currentSenderInboxId, xmtpConversationId])

  const { data: group, isLoading: isLoadingGroup } = useQuery(options)

  const memberProfiles = usePreferredDisplayInfoBatch({
    // For now just showing first 4 members
    xmtpInboxIds: group?.memberIds.slice(0, 4) ?? [],
    caller: "useGroupName",
  })

  // Create a fallback name based on member profiles
  const fallbackGroupName = (() => {
    if (!memberProfiles?.length) {
      return ""
    }

    const displayNames = memberProfiles.map((profile) => profile?.displayName || "")
    return getGroupNameForMemberNames({ names: displayNames })
  })()

  const isLoading = isLoadingGroup || memberProfiles.some((profile) => profile.isLoading)

  const groupName = group?.name || fallbackGroupName

  return {
    groupName,
    isLoading,
  }
}

function getGroupNameForMemberNames(args: { names: string[] }) {
  return args.names.join(", ")
}
