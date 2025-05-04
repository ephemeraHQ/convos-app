import React, { memo } from "react"
import { TextStyle, ViewStyle } from "react-native"
import { GroupAvatar } from "@/components/group-avatar"
import { HStack } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { getFormattedDisappearingDuration } from "@/features/disappearing-messages/disappearing-messages.constants"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { useGroupQuery } from "@/features/groups/queries/group.query"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { useCurrentXmtpConversationIdSafe } from "./conversation.store-context"

export const ConversationInfoBanner = memo(function ConversationInfoBanner() {
  const { theme, themed } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { groupName } = useGroupName({
    xmtpConversationId,
  })

  const { data: group } = useGroupQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const { data: disappearingMessageSettings } = useDisappearingMessageSettings({
    clientInboxId: currentSender.inboxId,
    conversationId: xmtpConversationId,
    caller: "ConversationInfoBanner",
  })

  return (
    <VStack style={{ gap: theme.spacing.sm }}>
      <VStack style={themed($banner)}>
        <HStack style={themed($bannerRow)}>
          <Icon icon="lock.fill" size={16} color={theme.colors.global.green} />
          <Text preset="smaller" color="secondary">
            Encrypted & decentralized
          </Text>
        </HStack>

        <HStack style={themed($bannerRow)}>
          <Icon icon="clock.fill" size={16} color={theme.colors.global.green} />
          <Text preset="smaller" color="secondary">
            Earlier messages are hidden for privacy
          </Text>
        </HStack>

        <HStack style={themed($bannerRow)}>
          <Icon icon="timer" size={16} color={theme.colors.global.green} />
          <Text preset="smaller" color="secondary">
            Messages disappear after{" "}
            {getFormattedDisappearingDuration(disappearingMessageSettings?.retentionDurationInNs)}
          </Text>
        </HStack>
      </VStack>

      <VStack style={themed($groupSection)}>
        <HStack style={{ gap: theme.spacing.xxxs }}>
          <GroupAvatar xmtpConversationId={xmtpConversationId} size="sm" />
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1 }}>
            {groupName}
          </Text>
        </HStack>
        {group?.description && (
          <Text preset="small" color="secondary" style={themed($groupDescription)}>
            {group.description}
          </Text>
        )}
      </VStack>
    </VStack>
  )
})

const $banner: ThemedStyle<ViewStyle> = ({ spacing, borderRadius, colors }) => ({
  padding: spacing.xs,
  borderRadius: borderRadius.sm,
  borderWidth: 1,
  borderColor: colors.border.subtle,
  gap: spacing.xxs,
  alignItems: "center",
  alignSelf: "center",
  flexWrap: "wrap",
  maxWidth: "90%",
})

const $bannerRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.xxs,
  flexDirection: "row",
})

const $groupSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  alignSelf: "center",
  gap: spacing.xxs,
  flexWrap: "wrap",
  maxWidth: "80%",
  marginBottom: spacing.sm,
})

const $groupDescription: ThemedStyle<TextStyle> = () => ({
  textAlign: "center",
})
