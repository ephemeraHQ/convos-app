import { memo, useCallback, useMemo } from "react"
import { VStack } from "@/design-system/VStack"
import { Pressable } from "@/design-system/Pressable"
import { ListItemEndRightChevron } from "@/design-system/list-item"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { GroupDetailsListItem } from "@/features/groups/ui/group-details.ui"
import { sortGroupMembers } from "@/features/groups/utils/sort-group-members"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"
import { MemberListItem } from "./group-details-members-list-item.component"
import { GroupDetailsMembersListHeader } from "./group-details-members-list-header.component"

export const GroupDetailsMembersList = memo(function GroupDetailsMembersList(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props
  const router = useRouter()
  const { theme } = useAppTheme()
  const currentSenderInboxId = useSafeCurrentSender().inboxId

  const { members } = useGroupMembers({
    caller: "GroupDetailsScreen",
    clientInboxId: currentSenderInboxId,
    xmtpConversationId,
  })

  const sortedMembers = useMemo(() => {
    return sortGroupMembers(Object.values(members?.byId || {}).filter(Boolean))
  }, [members])

  const handleAddMembersPress = useCallback(() => {
    router.push("AddGroupMembers", { xmtpConversationId })
  }, [xmtpConversationId, router])

  const handleSeeAllPress = useCallback(() => {
    router.push("GroupMembersList", { xmtpConversationId })
  }, [xmtpConversationId, router])

  // For demo purposes, we'll show a limited number of members
  const visibleMembers = sortedMembers.slice(0, 6)
  const hasMoreMembers = sortedMembers.length > visibleMembers.length

  return (
    <VStack
      style={{
        backgroundColor: theme.colors.background.surface,
        paddingVertical: theme.spacing.xs,
      }}
    >
      {/* Members Header */}
      <GroupDetailsMembersListHeader
        xmtpConversationId={xmtpConversationId}
        memberCount={sortedMembers.length}
        onAddMember={handleAddMembersPress}
      />

      {/* Members List */}
      <VStack>
        {visibleMembers.map((member) => {
          return <MemberListItem key={member.inboxId} memberInboxId={member.inboxId} />
        })}

        {hasMoreMembers && (
          <Pressable onPress={handleSeeAllPress} hitSlop={theme.spacing.sm}>
            <GroupDetailsListItem
              title={`See all ${sortedMembers.length}`}
              end={<ListItemEndRightChevron />}
            />
          </Pressable>
        )}
      </VStack>

      <GroupMemberDetailsBottomSheet />
    </VStack>
  )
})
