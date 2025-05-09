import { memo, useCallback, useMemo } from "react"
import { ActivityIndicator } from "react-native"
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
import { useProfilesBatchQuery } from "@/features/profiles/profiles.query"
import { Center } from "@/design-system/Center"

export const GroupDetailsMembersList = memo(function GroupDetailsMembersList(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props
  const router = useRouter()
  const { theme } = useAppTheme()
  const currentSenderInboxId = useSafeCurrentSender().inboxId

  // Get group members data
  const { membersArray, isLoading: isLoadingMembers } = useGroupMembers({
    caller: "GroupDetailsScreen",
    clientInboxId: currentSenderInboxId,
    xmtpConversationId,
  })

  // Extract member IDs for the preview (first 6 members)
  const previewMemberIds = useMemo(() => {
    // First do a basic priority sort without names
    const prioritySorted = sortGroupMembers(membersArray)
    // Take only the first 6 members for display
    const visibleMembers = prioritySorted.slice(0, 6)
    // Return their IDs for batch fetching
    return visibleMembers.map(member => member.inboxId)
  }, [membersArray])

  // Fetch profiles in batch using the new endpoint
  const { 
    data: batchProfilesData, 
    isLoading: isLoadingProfiles 
  } = useProfilesBatchQuery({
    xmtpIds: previewMemberIds,
    caller: "GroupDetailsScreen",
  })

  // Create a profiles map from the batch response
  const profilesMap = useMemo(() => {
    if (!batchProfilesData?.profiles) return {}
    return batchProfilesData.profiles
  }, [batchProfilesData])

  // Final sort with profiles data
  const sortedMembers = useMemo(() => {
    return sortGroupMembers(membersArray, profilesMap)
  }, [membersArray, profilesMap])

  // Take only the visible members for the preview
  const visibleMembers = useMemo(() => {
    return sortedMembers.slice(0, 6)
  }, [sortedMembers])

  const handleAddMembersPress = useCallback(() => {
    router.push("AddGroupMembers", { xmtpConversationId })
  }, [xmtpConversationId, router])

  const handleSeeAllPress = useCallback(() => {
    router.push("GroupMembersList", { xmtpConversationId })
  }, [xmtpConversationId, router])

  const hasMoreMembers = membersArray.length > visibleMembers.length
  const isLoading = isLoadingMembers || isLoadingProfiles

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
        memberCount={membersArray.length}
        onAddMember={handleAddMembersPress}
      />

      {/* Members List */}
      <VStack>
        {isLoading ? (
          <Center style={{ padding: theme.spacing.md }}>
            <ActivityIndicator size="small" color={theme.colors.text.primary} />
          </Center>
        ) : (
          <VStack>
            {visibleMembers.map((member) => {
              return (
                <MemberListItem 
                  key={member.inboxId} 
                  memberInboxId={member.inboxId} 
                  cachedProfile={profilesMap[member.inboxId]}
                />
              )
            })}

            {hasMoreMembers && (
              <Pressable onPress={handleSeeAllPress} hitSlop={theme.spacing.sm}>
                <GroupDetailsListItem
                  title={`See all ${membersArray.length}`}
                  end={<ListItemEndRightChevron />}
                />
              </Pressable>
            )}
          </VStack>
        )}
      </VStack>

      <GroupMemberDetailsBottomSheet />
    </VStack>
  )
})
