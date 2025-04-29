import { HStack } from "@design-system/HStack"
import { Pressable } from "@design-system/Pressable"
import { ITextProps, Text } from "@design-system/Text"
import { memo } from "react"
import { ViewStyle } from "react-native"
import { Avatar } from "@/components/avatar"
import { Center } from "@/design-system/Center"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { navigate } from "@/navigation/navigation.utils"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import {
  IConversationMessageGroupUpdated,
  IGroupUpdatedMetadataEntry,
} from "./conversation-message.types"

type IConversationMessageGroupUpdateProps = {
  message: IConversationMessageGroupUpdated
}

export function ConversationMessageGroupUpdate({ message }: IConversationMessageGroupUpdateProps) {
  const { theme } = useAppTheme()

  const content = message.content

  return (
    <Center
      // {...debugBorder()}
      style={{
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        flexWrap: "wrap",
        rowGap: theme.spacing.sm,
        width: "100%",
      }}
    >
      {/* Member additions */}
      {content.membersAdded.map((member) => (
        <ChatGroupMemberJoined
          key={`joined-${member.inboxId}`}
          inboxId={member.inboxId as IXmtpInboxId}
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
}

type IChatGroupMemberLeftProps = {
  inboxId: IXmtpInboxId
}

function ChatGroupMemberLeft({ inboxId }: IChatGroupMemberLeftProps) {
  const { themed, theme } = useAppTheme()
  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId,
    caller: "ChatGroupMemberLeft",
  })

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable
        style={themed($pressableContent)}
        onPress={() => {
          navigate("Profile", {
            inboxId,
          })
        }}
      >
        <Avatar sizeNumber={theme.avatarSize.xs} uri={avatarUrl} name={displayName ?? ""} />
        <ChatGroupUpdateText weight="bold">{displayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>left</ChatGroupUpdateText>
    </HStack>
  )
}

type IChatGroupMemberJoinedProps = {
  inboxId: IXmtpInboxId
}

function ChatGroupMemberJoined({ inboxId }: IChatGroupMemberJoinedProps) {
  const { themed, theme } = useAppTheme()
  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId,
    caller: "ChatGroupMemberJoined",
  })

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable
        onPress={() => {
          navigate("Profile", {
            inboxId,
          })
        }}
        style={themed($pressableContent)}
      >
        <Avatar sizeNumber={theme.avatarSize.xs} uri={avatarUrl} name={displayName ?? ""} />
        <ChatGroupUpdateText weight="bold">{displayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>joined</ChatGroupUpdateText>
    </HStack>
  )
}

function formatDisappearingTime(nanoseconds: string) {
  const ns = parseInt(nanoseconds, 10)
  const seconds = ns / 1_000_000_000
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24

  if (days >= 1 && days % 7 === 0) {
    const weeks = days / 7
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`
  } else if (days >= 1) {
    const daysValue = Math.floor(days)
    return `${daysValue} ${daysValue === 1 ? "day" : "days"}`
  } else if (hours >= 1) {
    const hoursValue = Math.floor(hours)
    return `${hoursValue} ${hoursValue === 1 ? "hour" : "hours"}`
  } else if (minutes >= 1) {
    const minutesValue = Math.floor(minutes)
    return `${minutesValue} ${minutesValue === 1 ? "minute" : "minutes"}`
  } else {
    const secondsValue = Math.floor(seconds)
    return `${secondsValue} ${secondsValue === 1 ? "second" : "seconds"}`
  }
}

type IChatGroupMetadataUpdateProps = {
  metadataEntry: IGroupUpdatedMetadataEntry
  initiatorInboxId: IXmtpInboxId
}

function ChatGroupMetadataUpdate({
  metadataEntry,
  initiatorInboxId,
}: IChatGroupMetadataUpdateProps) {
  const { themed, theme } = useAppTheme()
  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId: initiatorInboxId,
    caller: "ChatGroupMetadataUpdate",
  })

  let updateMessage = ""

  switch (metadataEntry.fieldName) {
    case "group_name":
      updateMessage = `changed group name to ${metadataEntry.newValue}`
      break
    case "group_image_url_square":
      updateMessage = "changed group photo"
      break
    case "description":
      updateMessage = `changed group description to ${metadataEntry.newValue}`
      break
    case "message_disappear_in_ns": {
      const newTime = formatDisappearingTime(metadataEntry.newValue)

      if (metadataEntry.oldValue === "0") {
        updateMessage = `set messages to disappear in ${newTime}`
      } else {
        const oldTime = formatDisappearingTime(metadataEntry.oldValue)
        updateMessage = `changed disappearing messages from ${oldTime} to ${newTime}`
      }
      break
    }
    // case "message_disappear_from_ns": {
    //   const timestamp = parseInt(metadataEntry.newValue, 10)
    //   const milliseconds = normalizeTimestampToMs(timestamp)
    //   const fromTime = getRelativeDateTime(milliseconds)
    //   updateMessage = `set messages to start disappearing from ${fromTime}`
    //   break
    // }
    default:
      return null
  }

  return (
    <HStack style={themed($memberContainer)}>
      <Pressable
        onPress={() => {
          navigate("Profile", {
            inboxId: initiatorInboxId,
          })
        }}
        style={themed($pressableContent)}
      >
        <Avatar sizeNumber={theme.avatarSize.xs} uri={avatarUrl} name={displayName ?? ""} />
        <ChatGroupUpdateText weight="bold">{displayName ?? ""}</ChatGroupUpdateText>
      </Pressable>
      <ChatGroupUpdateText>{updateMessage}</ChatGroupUpdateText>
    </HStack>
  )
}

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
