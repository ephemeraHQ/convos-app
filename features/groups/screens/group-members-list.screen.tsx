import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { FlashList } from "@shopify/flash-list"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { Center } from "@/design-system/Center"
import { EmptyState } from "@/design-system/empty-state"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { MemberListItem } from "@/features/groups/components/group-details-members-list-item.component"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { sortGroupMembers } from "@/features/groups/utils/sort-group-members"
import { useProfilesBatchQuery } from "@/features/profiles/profiles.query"
import { NavigationParamList } from "@/navigation/navigation.types"
import { useHeader } from "@/navigation/use-header"
import { useRouteParams, useRouter } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"

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
    <VStack style={{ flex: 1 }}>
      <Screen contentContainerStyle={$globalStyles.flex1}>
        <List />
      </Screen>
      <GroupMemberDetailsBottomSheet />
    </VStack>
  )
})

const List = memo(function List() {
  const insets = useSafeAreaInsets()
  const { theme } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const { xmtpConversationId } = useRouteParams<"GroupMembersList">()
  const [isLoading, setIsLoading] = useState(true)

  // Fetch group members
  const { members, isLoading: isLoadingMembers } = useGroupMembers({
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "GroupMembersListScreen",
  })

  // Extract member inbox IDs for batch fetching
  const memberInboxIds = useMemo(() => {
    if (!members) return []
    return Object.values(members.byId)
      .filter(Boolean)
      .map(member => member.inboxId)
  }, [members])

  // Fetch all profiles in a batch using the new endpoint
  const { 
    data: batchProfilesData, 
    isLoading: isLoadingProfiles,
    isSuccess: isProfileFetchSuccess,
    isError: isProfileError,
    error: profileError
  } = useProfilesBatchQuery({
    xmtpIds: memberInboxIds,
    caller: "GroupMembersListScreen",
  })

  // Create a cached profiles map from the batch response
  const cachedProfiles = useMemo(() => {
    if (!batchProfilesData?.profiles) return {}
    return batchProfilesData.profiles
  }, [batchProfilesData])

  // Sort members using the cached profiles
  const sortedMembers = useMemo(() => {
    if (!members) return []
    return sortGroupMembers(
      Object.values(members.byId).filter(Boolean),
      cachedProfiles
    )
  }, [members, cachedProfiles])

  // Reset loading state when data is fetched or an error occurs
  useEffect(() => {
    if ((isProfileFetchSuccess || isProfileError) && !isLoadingMembers) {
      setIsLoading(false)
    }
  }, [isProfileFetchSuccess, isProfileError, isLoadingMembers])

  // Show loading state
  if (isLoading || isLoadingMembers || isLoadingProfiles) {
    return (
      <Center style={{ flex: 1 }}>
        <VStack style={{ alignItems: "center", gap: theme.spacing.md }}>
          <ActivityIndicator size="large" color={theme.colors.text.primary} />
          <Text>Loading member profiles...</Text>
        </VStack>
      </Center>
    )
  }

  // Handle members not found
  if (!members) {
    return (
      <EmptyState
        title="Members not found"
        description="This might be an issue. Please report it to support."
      />
    )
  }

  // Handle profile fetch error
  if (isProfileError) {
    console.error("Error fetching profiles:", profileError)
    // Continue showing the list anyway - the individual MemberListItems will fallback
    // to showing shortened addresses if no profile is available
  }

  const foundProfilesCount = Object.keys(cachedProfiles).length
  const totalMembersCount = memberInboxIds.length

  return (
    <VStack style={{ flex: 1 }}>
      {foundProfilesCount < totalMembersCount && (
        <Text 
          style={{ 
            textAlign: 'center', 
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          Found profile info for {foundProfilesCount} of {totalMembersCount} members
        </Text>
      )}

      <FlashList
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}
        data={sortedMembers}
        renderItem={({ item }) => (
          <MemberListItem 
            key={item.inboxId} 
            memberInboxId={item.inboxId} 
            cachedProfile={cachedProfiles[item.inboxId]}
          />
        )}
        estimatedItemSize={60}
      />
    </VStack>
  )
})
