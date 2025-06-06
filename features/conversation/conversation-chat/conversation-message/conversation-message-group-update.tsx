import { HStack } from "@design-system/HStack"
import { Pressable } from "@design-system/Pressable"
import { ITextProps, Text } from "@design-system/Text"
import { memo, useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { Avatar } from "@/components/avatar"
import { Center } from "@/design-system/Center"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationType } from "@/features/conversation/hooks/use-conversation-type"
import { getFormattedDisappearingDurationStr } from "@/features/disappearing-messages/disappearing-messages.constants"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { navigate } from "@/navigation/navigation.utils"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import {
  IConversationMessageGroupUpdated,
  IGroupUpdatedMetadataEntry,
} from "./conversation-message.types"

type IConversationMessageGroupUpdateProps = {
  message: IConversationMessageGroupUpdated
}

export const ConversationMessageGroupUpdate = memo(function ConversationMessageGroupUpdate({
  message,
}: IConversationMessageGroupUpdateProps) {
  const { themed } = useAppTheme()
  const content = message.content

  return (
    <Center style={themed($center)}>
      {/* Member additions */}
      {content.membersAdded.map((member) => (
        <ChatGroupMemberJoined
          key={`joined-${member.inboxId}`}
          inboxId={member.inboxId}
          initiatedByInboxId={content.initiatedByInboxId}
          xmtpConversationId={message.xmtpConversationId}
        />
      ))}

      {/* Member removals */}
      {content.membersRemoved.map((member) => (
        <ChatGroupMemberRemoved
          key={`left-${member.inboxId}`}
          removedMemberInboxId={member.inboxId}
          initiatorMemberInboxId={content.initiatedByInboxId}
        />
      ))}

      {/* Metadata changes */}
      {content.metadataFieldsChanged.map((entry, index) => (
        <ChatGroupMetadataUpdate
          key={`metadata-${index}`}
          metadataEntry={entry}
          initiatorInboxId={content.initiatedByInboxId}
        />
      ))}
    </Center>
  )
})

const ChatGroupMemberRemoved = memo(function ChatGroupMemberRemoved({
  removedMemberInboxId,
  initiatorMemberInboxId,
}: {
  removedMemberInboxId: IXmtpInboxId
  initiatorMemberInboxId: IXmtpInboxId
}) {
  const { themed, theme } = useAppTheme()

  const { displayName: removedMemberDisplayName, avatarUrl: removedMemberAvatarUrl } =
    usePreferredDisplayInfo({
      inboxId: removedMemberInboxId,
      caller: "ChatGroupMemberRemoved",
    })
  const { displayName: initiatorDisplayName, avatarUrl: initiatorAvatarUrl } =
    usePreferredDisplayInfo({
      inboxId: initiatorMemberInboxId,
      caller: "ChatGroupMemberRemoved",
    })

  const handlePress = useCallback(() => {
    navigate("Profile", { inboxId: removedMemberInboxId })
  }, [removedMemberInboxId])

  const handleInitiatorPress = useCallback(() => {
    navigate("Profile", { inboxId: initiatorMemberInboxId })
  }, [initiatorMemberInboxId])

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable onPress={handleInitiatorPress} style={themed($pressableContent)}>
        <Avatar
          sizeNumber={theme.avatarSize.xs}
          uri={initiatorAvatarUrl}
          name={initiatorDisplayName ?? ""}
        />
        <ChatGroupUpdateText weight="bold">{initiatorDisplayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>removed</ChatGroupUpdateText>
      <Pressable style={themed($pressableContent)} onPress={handlePress}>
        <Avatar
          sizeNumber={theme.avatarSize.xs}
          uri={removedMemberAvatarUrl}
          name={removedMemberDisplayName ?? ""}
        />
        <ChatGroupUpdateText weight="bold">{removedMemberDisplayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
    </HStack>
  )
})

type IChatGroupMemberJoinedProps = {
  inboxId: IXmtpInboxId
  initiatedByInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

const ChatGroupMemberJoined = memo(function ChatGroupMemberJoined({
  inboxId,
  initiatedByInboxId,
  xmtpConversationId,
}: IChatGroupMemberJoinedProps) {
  const { themed, theme } = useAppTheme()

  const currentSender = useSafeCurrentSender()

  const { displayName: memberDisplayName, avatarUrl: memberAvatarUrl } = usePreferredDisplayInfo({
    inboxId,
    caller: "ChatGroupMemberJoined",
  })

  const { displayName: initiatorDisplayName, avatarUrl: initiatorAvatarUrl } =
    usePreferredDisplayInfo({
      inboxId: initiatedByInboxId,
      caller: "ChatGroupMemberJoined",
    })

  const handleMemberPress = useCallback(() => {
    navigate("Profile", { inboxId })
  }, [inboxId])

  const handleInitiatorPress = useCallback(() => {
    navigate("Profile", { inboxId: initiatedByInboxId })
  }, [initiatedByInboxId])

  // Get the current conversation to check if it's a DM or a group
  const { data: type } = useConversationType({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ChatGroupMemberJoined",
  })

  const isDm = type === "dm"

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable onPress={handleMemberPress} style={themed($pressableContent)}>
        <Avatar
          sizeNumber={theme.avatarSize.xs}
          uri={memberAvatarUrl}
          name={memberDisplayName ?? ""}
        />
        <ChatGroupUpdateText weight="bold">{memberDisplayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>{isDm ? "joined" : "was invited"}</ChatGroupUpdateText>

      {/* Show inviter if their displayName is available and it's not a DM */}
      {!isDm && initiatorDisplayName && (
        <Pressable onPress={handleInitiatorPress} style={themed($pressableContent)}>
          <ChatGroupUpdateText>by</ChatGroupUpdateText>
          <Avatar
            sizeNumber={theme.avatarSize.xs}
            uri={initiatorAvatarUrl}
            name={initiatorDisplayName ?? ""}
          />
          <ChatGroupUpdateText weight="bold">{initiatorDisplayName ?? ""}</ChatGroupUpdateText>
        </Pressable>
      )}
    </HStack>
  )
})

type IChatGroupMetadataUpdateProps = {
  metadataEntry: IGroupUpdatedMetadataEntry
  initiatorInboxId: IXmtpInboxId
}

const ChatGroupMetadataUpdate = memo(function ChatGroupMetadataUpdate({
  metadataEntry,
  initiatorInboxId,
}: IChatGroupMetadataUpdateProps) {
  const { themed, theme } = useAppTheme()

  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId: initiatorInboxId,
    caller: "ChatGroupMetadataUpdate" as const,
  })

  const handlePress = useCallback(() => {
    navigate("Profile", { inboxId: initiatorInboxId })
  }, [initiatorInboxId])

  const updateMessage = useMemo(() => {
    switch (metadataEntry.fieldName) {
      case "group_name":
        return `changed the group name to ${metadataEntry.newValue}`
      case "group_image_url_square":
        return "changed the group photo"
      case "description":
        return `changed the group description to ${metadataEntry.newValue}`
      case "message_disappear_in_ns": {
        const newValue = parseInt(metadataEntry.newValue, 10)
        const newTime = getFormattedDisappearingDurationStr(newValue)

        if (newValue === 0) {
          return `disabled disappearing messages`
        } else if (metadataEntry.oldValue === "0") {
          return `set messages to disappear in ${newTime}`
        } else {
          const oldValue = parseInt(metadataEntry.oldValue, 10)
          const oldTime = getFormattedDisappearingDurationStr(oldValue)
          return `changed disappearing messages from ${oldTime} to ${newTime}`
        }
      }
      // case "message_disappear_from_ns": {
      //   const timestamp = parseInt(metadataEntry.newValue, 10)
      //   const milliseconds = normalizeTimestampToMs(timestamp)
      //   const fromTime = getRelativeDateTime(milliseconds)
      //   return `set messages to start disappearing from ${fromTime}`
      // }
      default:
        return null
    }
  }, [metadataEntry])

  // If no message could be determined, don't render anything
  if (!updateMessage) return null

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable onPress={handlePress} style={themed($pressableContent)}>
        <Avatar sizeNumber={theme.avatarSize.xs} uri={avatarUrl} name={displayName ?? ""} />
        <ChatGroupUpdateText weight="bold">{displayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>{updateMessage}</ChatGroupUpdateText>
    </HStack>
  )
})

const ChatGroupUpdateText = memo(function ChatGroupUpdateText(props: ITextProps) {
  const { style, ...rest } = props
  return (
    <Text
      style={[{ textAlign: "center", flexWrap: "wrap" }, style]}
      color="secondary"
      preset="smaller"
      {...rest}
    />
  )
})

const $memberContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
  columnGap: spacing.xxxs,
  width: "100%",
})

const $pressableContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  columnGap: spacing.xxxs,
  alignItems: "center",
  flexDirection: "row",
})

const $center: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  flexWrap: "wrap" as const,
  rowGap: spacing.sm,
  width: "100%",
})
