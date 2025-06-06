import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { FlashList } from "@shopify/flash-list"
import React, { memo, useCallback, useMemo } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { IExtendedEdge } from "@/components/screen/screen.helpers"
import { Center } from "@/design-system/Center"
import { EmptyState } from "@/design-system/empty-state"
import { IHeaderProps } from "@/design-system/Header/Header"
import { IIconName } from "@/design-system/Icon/Icon.types"
import { Loader } from "@/design-system/loader"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { MemberListItem } from "@/features/groups/components/group-details-members-list-item.component"
import { GroupMemberDetailsBottomSheet } from "@/features/groups/components/group-member-details/group-member-details.bottom-sheet"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { useCurrentSenderGroupPermissions } from "@/features/groups/hooks/use-group-permissions.hook"
import { useSortedGroupMembers } from "@/features/groups/queries/group-members-sorted.query"
import { NavigationParamList } from "@/navigation/navigation.types"
import { useHeader } from "@/navigation/use-header"
import { useRouteParams, useRouter } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"

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

  const { canAddMembers } = useCurrentSenderGroupPermissions({
    xmtpConversationId,
  })

  const headerOptions = useMemo(() => {
    return {
      safeAreaEdges: ["top"] as IExtendedEdge[],
      title: "Members",
      leftIcon: "chevron.left" as IIconName,
      onLeftPress: handleBackPress,
      rightIcon: "plus" as IIconName,
      onRightPress: canAddMembers ? handleAddMembersPress : undefined,
    } satisfies IHeaderProps
  }, [handleBackPress, handleAddMembersPress, canAddMembers])

  useHeader(headerOptions, [headerOptions])

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

  const { members } = useGroupMembers({
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "GroupMembersListScreen",
  })

  const { data: sortedMemberIds = [], isLoading } = useSortedGroupMembers({
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "GroupMembersListScreen",
    members: Object.values(members?.byId || {}),
  })

  if (isLoading) {
    return (
      <Center style={$globalStyles.flex1}>
        <Loader />
      </Center>
    )
  }

  if (sortedMemberIds.length === 0) {
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
