import { useQuery } from "@tanstack/react-query"
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

  const { data: group, isLoading: isLoadingGroup } = useQuery({
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

  const memberProfiles = usePreferredDisplayInfoBatch({
    xmtpInboxIds: group?.memberIds ?? [],
  })

  // Create a fallback name based on member profiles
  // This will only recalculate when memberProfiles actually changes
  const fallbackGroupName = useMemo(() => {
    if (!memberProfiles?.length) {
      return ""
    }

    const displayNames = memberProfiles.map((profile) => profile?.displayName || "")
    return getGroupNameForMemberNames({ names: displayNames })
  }, [memberProfiles])

  const isLoading = useMemo(() => {
    return isLoadingGroup || memberProfiles.some((profile) => profile.isLoading)
  }, [isLoadingGroup, memberProfiles])

  // Simple selection between group name and fallback
  const groupName = group?.name || fallbackGroupName

  return {
    groupName,
    isLoading,
  }
}

function getGroupNameForMemberNames(args: { names: string[] }) {
  return args.names.join(", ")
}
