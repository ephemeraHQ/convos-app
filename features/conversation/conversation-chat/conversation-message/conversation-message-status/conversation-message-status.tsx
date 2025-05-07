import React, { memo, useEffect, useMemo } from "react"
import { Center } from "@/design-system/Center"
import { HStack } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { Loader } from "@/design-system/loader"
import { AnimatedText } from "@/design-system/Text"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useConversationMessageStatus } from "@/features/conversation/conversation-chat/conversation-message/hooks/use-conversation-message-status"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { usePrevious } from "@/hooks/use-previous-value"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/use-app-theme"
import { Haptics } from "@/utils/haptics"

export const ConversationMessageStatus = memo(function ConversationMessageStatus() {
  const { theme } = useAppTheme()

  const xmtpMessageId = useConversationMessageContextSelector((state) => state.currentMessageId)
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const currentSender = useSafeCurrentSender()

  const { data: messageStatus } = useConversationMessageStatus({
    xmtpMessageId,
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const previousStatus = usePrevious(messageStatus)

  // Haptic feedback when the message status changes from sending to sent
  useEffect(() => {
    if (previousStatus === "sending" && messageStatus === "sent") {
      Haptics.softImpactAsync()
    }
  }, [previousStatus, messageStatus])

  const statusText = useMemo(() => {
    if (!messageStatus || messageStatus === "sending") {
      return "Sending"
    }

    if (messageStatus === "sent") {
      return translate("message_status.sent")
    }

    return null
  }, [messageStatus])

  const statusIcon = useMemo(() => {
    if (!messageStatus || messageStatus === "sending") {
      return <Loader size="xxs" />
    }

    if (messageStatus === "sent") {
      return <Icon size={theme.iconSize.xs} color={theme.colors.text.secondary} icon="checkmark" />
    }

    return null
  }, [messageStatus, theme])

  return (
    <HStack
      style={{
        alignItems: "center",
        columnGap: theme.spacing.xxxs,
        paddingVertical: theme.spacing.xxxs,
      }}
    >
      <AnimatedText color="secondary" size="xxs">
        {statusText}
      </AnimatedText>
      <Center
        style={{
          width: 14, // Following Figma design
          height: 14, // Following Figma design
          padding: 1, // Following Figma design
        }}
      >
        {statusIcon}
      </Center>
    </HStack>
  )
})
