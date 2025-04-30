import React, { memo } from "react"
import { useDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { VStack } from "@/design-system/VStack"
import { HStack } from "@/design-system/HStack"
import { Text } from "@/design-system/Text"
import { useAppTheme } from "@/theme/use-app-theme"
import { Icon } from "@/design-system/Icon/Icon"
import { getFormattedDisappearingDuration } from "@/features/disappearing-messages/disappearing-messages.constants"
import { GroupAvatar } from "@/components/group-avatar"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { useGroupQuery } from "@/features/groups/queries/group.query"
import { useCurrentXmtpConversationIdSafe } from "./conversation.store-context"

export const ConversationInfoBanner = memo(function ConversationInfoBanner() {
  const { theme } = useAppTheme()
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
  
  const showDisappearingMessage = Boolean(
    disappearingMessageSettings?.retentionDurationInNs &&
    disappearingMessageSettings.retentionDurationInNs > 0
  )
  
  return (
    <VStack>
      <VStack
        style={{
          backgroundColor: theme.colors.background.sunken,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.lg,
          margin: theme.spacing.md,
          marginBottom: 0,
          gap: theme.spacing.sm,
        }}
      >
        <HStack style={{ alignItems: "center", gap: theme.spacing.xxs }}>
          <Icon icon="lock" size={16} color={theme.colors.global.primary} />
          <Text preset="body" color="primary">
            Encrypted & decentralized
          </Text>
        </HStack>
        
        <HStack style={{ alignItems: "center", gap: theme.spacing.xxs }}>
          <Icon icon="clock" size={16} color={theme.colors.global.primary} />
          <Text preset="body" color="primary">
            Earlier messages are hidden for privacy
          </Text>
        </HStack>
        
        {showDisappearingMessage && (
          <HStack style={{ alignItems: "center", gap: theme.spacing.xxs }}>
            <Icon icon="timer" size={16} color={theme.colors.global.primary} />
            <Text preset="body" color="primary">
              Messages disappear after {getFormattedDisappearingDuration(disappearingMessageSettings!.retentionDurationInNs)}
            </Text>
          </HStack>
        )}  
      </VStack>
      <VStack style={{ alignItems: "center", marginTop: theme.spacing.lg, gap: theme.spacing.xxs }}>
        <GroupAvatar xmtpConversationId={xmtpConversationId} size="lg" />
        <Text preset="bigBold" style={{ textAlign: "center" }}>{groupName}</Text>
        {group?.description && (
          <Text style={{ textAlign: "center" }}>{group.description}desc</Text>
        )}
      </VStack>
    </VStack>
  )
})
