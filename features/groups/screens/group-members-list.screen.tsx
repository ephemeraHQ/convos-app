import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { FlashList } from "@shopify/flash-list"
import React, { memo, useCallback, useEffect, useState } from "react"
import { ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { Center } from "@/design-system/Center"
import { EmptyState } from "@/design-system/empty-state"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { MemberListItem } from "@/features/groups/components/group-details-members-list-item.component"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { sortGroupMembers } from "@/features/groups/utils/sort-group-members"
import { NavigationParamList } from "@/navigation/navigation.types"
import { useHeader } from "@/navigation/use-header"
import { useRouteParams, useRouter } from "@/navigation/use-navigation"
import { ensureProfileQueryData } from "@/features/profiles/profiles.query"
import { $globalStyles } from "@/theme/styles"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { IXmtpInboxId } from "@features/xmtp/xmtp.types"

export const GroupMembersListScreen = memo(function GroupMembersListScreen(
  props: NativeStackScreenProps<NavigationParamList, "GroupMembersList">,
) {
  const router = useRouter()
  const { xmtpConversationId } = props.route.params

  const handleBackPress = useCallback(() => {
    router.goBack()
  }, [router])

  const handleAddMembersPress = useCallback(() => {
    router.navigate("AddGroupMembers", { xmtpConversationId })
  }, [router, xmtpConversationId])

  // Set up header
  useHeader(
    {
      safeAreaEdges: ["top"],
      title: "Members",
      leftIcon: "chevron.left",
      onLeftPress: handleBackPress,
      rightIcon: "plus",
      onRightPress: handleAddMembersPress,
    },
    [handleBackPress, handleAddMembersPress],
  )

  return (
    <>
      <Screen contentContainerStyle={$globalStyles.flex1}>
        <List />
      </Screen>
      <GroupMemberDetailsBottomSheet />
    </>
  )
})

const List = memo(function List() {
  const insets = useSafeAreaInsets()
  const currentSender = useSafeCurrentSender()
  const { xmtpConversationId } = useRouteParams<"GroupMembersList">()
  const [sortedMemberIds, setSortedMemberIds] = useState<IXmtpInboxId[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)

  const { members, isLoading: isLoadingMembers } = useGroupMembers({
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "GroupMembersListScreen",
  })

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
          caller: "GroupMembersListScreen" 
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
      
      // Extract just the sorted inbox IDs
      const sortedIds = sorted.map(member => member.inboxId)
      setSortedMemberIds(sortedIds)
      setIsLoadingProfiles(false)
    })
    .catch(error => {
      captureError(new GenericError({
        error,
        additionalMessage: "Error loading profiles"
      }))
      // Fall back to existing sort without profile data
      const sortedMembers = sortGroupMembers(Object.values(members.byId))
      const sortedIds = sortedMembers.map(member => member.inboxId)
      setSortedMemberIds(sortedIds)
      setIsLoadingProfiles(false)
    })
  }, [members?.ids, members?.byId])

  if (isLoadingMembers || isLoadingProfiles) {
    return (
      <Center style={$globalStyles.flex1}>
        <ActivityIndicator size="large" />
      </Center>
    )
  }

  if (!members) {
    return (
      <EmptyState
        title="Members not found"
        description="This might be an issue. Please report it to support."
      />
    )
  }

  return (
    <FlashList
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
      data={sortedMemberIds}
      renderItem={({ item }) => <MemberListItem memberInboxId={item} />}
      estimatedItemSize={60}
    />
  )
})
