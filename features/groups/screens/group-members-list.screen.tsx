import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { FlashList } from "@shopify/flash-list"
import { memo, useCallback } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { EmptyState } from "@/design-system/empty-state"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { MemberListItem } from "@/features/groups/components/group-details-members-list-item.component"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { useGroupQuery } from "@/features/groups/queries/group.query"
import { sortGroupMembers } from "@/features/groups/utils/sort-group-members"
import { NavigationParamList } from "@/navigation/navigation.types"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"

export const GroupMembersListScreen = memo(function GroupMembersListScreen(
  props: NativeStackScreenProps<NavigationParamList, "GroupMembersList">,
) {
  const router = useRouter()
  const { xmtpConversationId } = props.route.params
  const currentSender = useSafeCurrentSender()
  const insets = useSafeAreaInsets()

  const { data: group, isLoading: isGroupLoading } = useGroupQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

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

  if (isGroupLoading) {
    return null
  }

  if (!group) {
    return (
      <Screen preset="fixed">
        <EmptyState
          title="Group not found"
          description="This might be an issue. Please report it to support."
        />
      </Screen>
    )
  }

  return (
    <>
      <Screen contentContainerStyle={$globalStyles.flex1}>
        <FlashList
          contentContainerStyle={{
            paddingBottom: insets.bottom,
          }}
          data={sortGroupMembers(Object.values(group?.members.byId || {}))}
          renderItem={({ item }) => <MemberListItem memberInboxId={item.inboxId} />}
          estimatedItemSize={60}
        />
      </Screen>
      <GroupMemberDetailsBottomSheet />
    </>
  )
})
