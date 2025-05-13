import { HStack } from "@design-system/HStack"
import { Pressable } from "@design-system/Pressable"
import { ITextProps, Text } from "@design-system/Text"
import { memo, useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { Avatar } from "@/components/avatar"
import { Center } from "@/design-system/Center"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { navigate } from "@/navigation/navigation.utils"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import {
  IConversationMessageGroupUpdated,
  IGroupUpdatedMetadataEntry,
} from "./conversation-message.types"
import { getFormattedDisappearingDuration } from "@/features/disappearing-messages/disappearing-messages.constants"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"

type IConversationMessageGroupUpdateProps = {
  message: IConversationMessageGroupUpdated
}

export const ConversationMessageGroupUpdate = memo(function ConversationMessageGroupUpdate({ message }: IConversationMessageGroupUpdateProps) {
  const { themed } = useAppTheme()
  const content = message.content

  return (
    <Center style={themed($center)}>
      {/* Member additions */}
      {content.membersAdded.map((member) => (
        <ChatGroupMemberJoined
          key={`joined-${member.inboxId}`}
          inboxId={member.inboxId as IXmtpInboxId}
          initiatedByInboxId={content.initiatedByInboxId as IXmtpInboxId}
          xmtpConversationId={message.xmtpConversationId}
        />
      ))}

      {/* Member removals */}
      {content.membersRemoved.map((member) => (
        <ChatGroupMemberLeft
          key={`left-${member.inboxId}`}
          inboxId={member.inboxId as IXmtpInboxId}
        />
      ))}

      {/* Metadata changes */}
      {content.metadataFieldsChanged.map((entry, index) => (
        <ChatGroupMetadataUpdate
          key={`metadata-${index}`}
          metadataEntry={entry}
          initiatorInboxId={content.initiatedByInboxId as IXmtpInboxId}
        />
      ))}
    </Center>
  )
})

type IChatGroupMemberLeftProps = {
  inboxId: IXmtpInboxId
}

const ChatGroupMemberLeft = memo(function ChatGroupMemberLeft({ inboxId }: IChatGroupMemberLeftProps) {
  const { themed, theme } = useAppTheme()
  
  const displayInfoParams = useMemo(() => ({
    inboxId,
    caller: "ChatGroupMemberLeft" as const,
  }), [inboxId]);
  
  const { displayName, avatarUrl } = usePreferredDisplayInfo(displayInfoParams)

  const handlePress = useCallback(() => {
    navigate("Profile", { inboxId })
  }, [inboxId])

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable
        style={themed($pressableContent)}
        onPress={handlePress}
      >
        <Avatar sizeNumber={theme.avatarSize.xs} uri={avatarUrl} name={displayName ?? ""} />
        <ChatGroupUpdateText weight="bold">{displayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>left</ChatGroupUpdateText>
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
  xmtpConversationId 
}: IChatGroupMemberJoinedProps) {
  const { themed, theme } = useAppTheme()

  const currentSender = useSafeCurrentSender()
  
  const memberDisplayInfoParams = useMemo(() => ({
    inboxId,
    caller: "ChatGroupMemberJoined" as const,
  }), [inboxId]);
  
  const { displayName, avatarUrl } = usePreferredDisplayInfo(memberDisplayInfoParams)

  const initiatorDisplayInfoParams = useMemo(() => ({
    inboxId: initiatedByInboxId,
    caller: "ChatGroupMemberJoined" as const,
  }), [initiatedByInboxId]);
  
  const { displayName: initiatorDisplayName, avatarUrl: initiatorAvatarUrl } = usePreferredDisplayInfo(initiatorDisplayInfoParams)

  const handleMemberPress = useCallback(() => {
    navigate("Profile", { inboxId })
  }, [inboxId])

  const handleInitiatorPress = useCallback(() => {
    navigate("Profile", { inboxId: initiatedByInboxId })
  }, [initiatedByInboxId])

  // Get the current conversation to check if it's a DM or a group
  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ChatGroupMemberJoined",
  })

  const isDm = conversation ? isConversationDm(conversation) : false

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable
        onPress={handleMemberPress}
        style={themed($pressableContent)}
      >
        <Avatar sizeNumber={theme.avatarSize.xs} uri={avatarUrl} name={displayName ?? ""} />
        <ChatGroupUpdateText weight="bold">{displayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>{isDm ? "joined" : "was invited"}</ChatGroupUpdateText>

      {/* Show inviter if their displayName is available and it's not a DM */}
      {!isDm && initiatorDisplayName && (
        <Pressable
          onPress={handleInitiatorPress}
          style={themed($pressableContent)}
        >
          <ChatGroupUpdateText>by</ChatGroupUpdateText>
          <Avatar sizeNumber={theme.avatarSize.xs} uri={initiatorAvatarUrl} name={initiatorDisplayName ?? ""} />
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
  
  const displayInfoParams = useMemo(() => ({
    inboxId: initiatorInboxId,
    caller: "ChatGroupMetadataUpdate" as const,
  }), [initiatorInboxId]);
  
  const { displayName, avatarUrl } = usePreferredDisplayInfo(displayInfoParams)

  const handlePress = useCallback(() => {
    navigate("Profile", { inboxId: initiatorInboxId })
  }, [initiatorInboxId])

  const updateMessage = useMemo(() => {
    switch (metadataEntry.fieldName) {
      case "group_name":
        return `changed group name to ${metadataEntry.newValue}`
      case "group_image_url_square":
        return "changed group photo"
      case "description":
        return `changed group description to ${metadataEntry.newValue}`
      case "message_disappear_in_ns": {
        const oldValue = parseInt(metadataEntry.oldValue, 10)
        const newValue = parseInt(metadataEntry.newValue, 10)
        const newTime = getFormattedDisappearingDuration(newValue)

        if (newValue === 1) {
          // transition to cleared chat
          return "cleared the chat"
        } else if (oldValue === 1 && newValue > 0) {
          // transition from cleared chat
          return `set messages to disappear in ${newTime}`
        } else if (newValue === 0) {
          return "turned off disappearing messages"
        } else if (oldValue === 0) {
          return `set messages to disappear in ${newTime}`
        } else {
          const oldTime = getFormattedDisappearingDuration(oldValue)
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
      <Pressable
        onPress={handlePress}
        style={themed($pressableContent)}
      >
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
