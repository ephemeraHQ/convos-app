import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator } from "react-native"
import { VStack } from "@/design-system/VStack"
import { Pressable } from "@/design-system/Pressable"
import { ListItemEndRightChevron } from "@/design-system/list-item"
import { Center } from "@/design-system/Center"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { GroupDetailsListItem } from "@/features/groups/ui/group-details.ui"
import { sortGroupMembers } from "@/features/groups/utils/sort-group-members"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"
import { MemberListItem } from "./group-details-members-list-item.component"
import { GroupDetailsMembersListHeader } from "./group-details-members-list-header.component"
import { ensureProfileQueryData } from "@/features/profiles/profiles.query"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

export const GroupDetailsMembersList = memo(function GroupDetailsMembersList(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props
  const router = useRouter()
  const { theme } = useAppTheme()
  const currentSenderInboxId = useSafeCurrentSender().inboxId
  const [sortedMemberIds, setSortedMemberIds] = useState<IXmtpInboxId[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)

  const { members, isLoading: isLoadingMembers } = useGroupMembers({
    caller: "GroupDetailsScreen",
    clientInboxId: currentSenderInboxId,
    xmtpConversationId,
  })

  // Load profiles and sort members
  useEffect(() => {
    if (!members?.ids?.length) return

    setIsLoadingProfiles(true)
    
    // Get member inbox IDs
    const memberInboxIds = members.ids.map(id => members.byId[id].inboxId)
    
    // Load all profiles
    Promise.all(
      memberInboxIds.map(inboxId => 
        ensureProfileQueryData({ 
          xmtpId: inboxId, 
          caller: "GroupDetailsMembersList" 
        })
      )
    )
    .then(profiles => {
      // Create member-profile pairs for enhanced sorting
      const memberProfilePairs = Object.values(members.byId).map((member, idx) => {
        // Find the profile by matching member's inboxId
        const profileIndex = memberInboxIds.findIndex(id => id === member.inboxId)
        const profile = profileIndex !== -1 ? profiles[profileIndex] : null
        return { 
          ...member,
          profile
        }
      })
      
      // Use the enhanced sorting with profiles
      const sorted = sortGroupMembers(memberProfilePairs)
      
      // Extract just the inbox IDs
      setSortedMemberIds(sorted.map(member => member.inboxId))
      setIsLoadingProfiles(false)
    })
    .catch(error => {
      captureError(new GenericError({
        error,
        additionalMessage: "Error loading profiles for group members list"
      }))
      // Fall back to basic sorting without profiles
      const sortedMembers = sortGroupMembers(Object.values(members.byId))
      setSortedMemberIds(sortedMembers.map(member => member.inboxId))
      setIsLoadingProfiles(false)
    })
  }, [members?.ids, members?.byId])
  
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
  if (isLoadingMembers || isLoadingProfiles) {
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
