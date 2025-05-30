import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { memo, useCallback } from "react"
import { Alert } from "react-native"
import { GroupAvatar } from "@/components/group-avatar"
import { Screen } from "@/components/screen/screen"
import { Center } from "@/design-system/Center"
import { EmptyState } from "@/design-system/empty-state"
import { Icon } from "@/design-system/Icon/Icon"
import { ListItem, ListItemTitle } from "@/design-system/list-item"
import { Pressable } from "@/design-system/Pressable"
import { Switch } from "@/design-system/switch"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationMetadataQuery } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { useMuteConversationMutation } from "@/features/conversation/conversation-metadata/mute-conversation.mutation"
import { useUnmuteConversationMutation } from "@/features/conversation/conversation-metadata/unmute-conversation.mutation"
import { GroupDetailsMembersList } from "@/features/groups/components/group-details-members-list.component"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { useCurrentSenderGroupPermissions } from "@/features/groups/hooks/use-group-permissions.hook"
import { useGroupQuery } from "@/features/groups/queries/group.query"
import { NavigationParamList } from "@/navigation/navigation.types"
import { useRouteParams } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { useGroupDetailsScreenHeader } from "./group-details.screen-header"

export const GroupDetailsScreen = memo(function GroupDetailsScreen(
  props: NativeStackScreenProps<NavigationParamList, "GroupDetails">,
) {
  const { xmtpConversationId } = props.route.params

  const { theme } = useAppTheme()

  const currentSender = useSafeCurrentSender()

  const { groupName } = useGroupName({
    xmtpConversationId,
  })

  const { data: group } = useGroupQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const { isSuperAdmin } = useCurrentSenderGroupPermissions({
    xmtpConversationId,
  })

  useGroupDetailsScreenHeader({ xmtpConversationId })

  const handleExitPress = useCallback(() => {
    Alert.alert(
      "Exit Group",
      isSuperAdmin
        ? "You are the super admin of this group. If you exit, the group will lose its super admin."
        : "Are you sure you want to exit this group?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => {
            // Logic to exit group would go here
            Alert.alert("Exit functionality not implemented yet")
          },
        },
      ],
    )
  }, [isSuperAdmin])

  if (!group) {
    return (
      <Screen contentContainerStyle={$globalStyles.flex1}>
        <EmptyState
          title="Group not found"
          description="This might be an issue. Please report it to support."
          hasScreenHeader
        />
      </Screen>
    )
  }

  return (
    <Screen preset="scroll" safeAreaEdges={["bottom"]}>
      {/* Header Section with Avatar and Group Info */}
      <VStack
        style={{
          paddingBottom: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.background.surface,
          alignItems: "center",
          justifyContent: "center",
          rowGap: theme.spacing.sm,
        }}
      >
        <GroupAvatar xmtpConversationId={xmtpConversationId} size="xxl" />
        <VStack style={{ alignItems: "center", rowGap: theme.spacing.xxs }}>
          <Text preset="bigBold" style={{ textAlign: "center" }}>
            {groupName}
          </Text>
          {group?.description && <Text style={{ textAlign: "center" }}>{group?.description}</Text>}
          {/* <Text color="secondary" style={{ textAlign: "center" }}>
            convos.com/convos-crew
          </Text> */}
        </VStack>
      </VStack>
      <Separator />
      <GroupDetailsScreenMuteButton />
      <Separator />
      <GroupDetailsMembersList xmtpConversationId={xmtpConversationId} />
      <Separator />
      {/* Exit Button */}
      <Pressable
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.background.surface,
        }}
        onPress={handleExitPress}
      >
        <ListItem title={<ListItemTitle color="caution">Exit</ListItemTitle>} />
      </Pressable>

      <Separator />
    </Screen>
  )
})

const GroupDetailsScreenMuteButton = memo(function GroupDetailsScreenMuteButton() {
  const { theme } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const { xmtpConversationId } = useRouteParams<"GroupDetails">()

  const { data: conversationMetadata, isFetching } = useConversationMetadataQuery({
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
  })

  const { mutateAsync: muteConversationAsync } = useMuteConversationMutation({
    xmtpConversationId,
    caller: "GroupDetailsScreenMuteButton",
  })
  const { mutateAsync: unmuteConversationAsync } = useUnmuteConversationMutation({
    xmtpConversationId,
    caller: "GroupDetailsScreenMuteButton",
  })

  const handleMutePress = useCallback(
    async (value: boolean) => {
      if (value) {
        try {
          await muteConversationAsync()
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              additionalMessage: "Failed to mute conversation",
              error,
            }),
            {
              message: "Failed to mute conversation",
            },
          )
        }
      } else {
        try {
          await unmuteConversationAsync()
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              additionalMessage: "Failed to unmute conversation",
              error,
            }),
            {
              message: "Failed to unmute conversation",
            },
          )
        }
      }
    },
    [muteConversationAsync, unmuteConversationAsync],
  )

  return (
    <ListItem
      avatar={
        <Center
          style={{
            backgroundColor: theme.colors.fill.minimal,
            borderRadius: theme.borderRadius.full,
            width: theme.spacing.container.large,
            height: theme.spacing.container.large,
          }}
        >
          <Icon size={theme.iconSize.md} icon="bell-slash" />
        </Center>
      }
      title={<ListItemTitle>Mute</ListItemTitle>}
      end={
        <Switch
          disabled={isFetching}
          value={conversationMetadata?.muted}
          onValueChange={handleMutePress}
        />
      }
    />
  )
})

const Separator = memo(function Separator() {
  const { theme } = useAppTheme()

  return (
    <VStack
      style={{
        backgroundColor: theme.colors.background.sunken,
        height: theme.spacing.xxs,
      }}
    />
  )
})
