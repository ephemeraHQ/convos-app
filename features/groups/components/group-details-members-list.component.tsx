import { memo, useCallback } from "react"
import { ActivityIndicator } from "react-native"
import { VStack } from "@/design-system/VStack"
import { Pressable } from "@/design-system/Pressable"
import { ListItemEndRightChevron } from "@/design-system/list-item"
import { Center } from "@/design-system/Center"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { GroupDetailsListItem } from "@/features/groups/ui/group-details.ui"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"
import { MemberListItem } from "./group-details-members-list-item.component"
import { GroupDetailsMembersListHeader } from "./group-details-members-list-header.component"
import { useGroupMembersWithSorting } from "@/features/groups/queries/group-members-sorted.query"

export const GroupDetailsMembersList = memo(function GroupDetailsMembersList(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props
  const router = useRouter()
  const { theme } = useAppTheme()
  const currentSenderInboxId = useSafeCurrentSender().inboxId
  
  const { members, sortedMemberIds, isLoading } = useGroupMembersWithSorting({
    caller: "GroupDetailsScreen",
    clientInboxId: currentSenderInboxId,
    xmtpConversationId,
  })
  
  const handleAddMembersPress = useCallback(() => {
    router.push("AddGroupMembers", { xmtpConversationId })
  }, [xmtpConversationId, router])

  const handleSeeAllPress = useCallback(() => {
    router.push("GroupMembersList", { xmtpConversationId })
  }, [xmtpConversationId, router])

  // Show a limited number of members
  const visibleMemberIds = sortedMemberIds.slice(0, 6)
  const hasMoreMembers = sortedMemberIds.length > visibleMemberIds.length

  // Show loading state
  if (isLoading) {
    return (
      <VStack
        style={{
          backgroundColor: theme.colors.background.surface,
          paddingVertical: theme.spacing.md,
        }}
      >
        <Center style={{ height: 100 }}>
          <ActivityIndicator size="small" />
        </Center>
      </VStack>
    )
  }

  // If no members, show nothing
  if (!members?.ids?.length || sortedMemberIds.length === 0) {
    return null
  }

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
        memberCount={sortedMemberIds.length}
        onAddMember={handleAddMembersPress}
      />

      {/* Members List */}
      <VStack>
        {visibleMemberIds.map((inboxId) => {
          return <MemberListItem key={inboxId} memberInboxId={inboxId} />
        })}

        {hasMoreMembers && (
          <Pressable onPress={handleSeeAllPress} hitSlop={theme.spacing.sm}>
            <GroupDetailsListItem
              title={`See all ${sortedMemberIds.length}`}
              end={<ListItemEndRightChevron />}
            />
          </Pressable>
        )}
      </VStack>

      <GroupMemberDetailsBottomSheet />
    </VStack>
  )
})
