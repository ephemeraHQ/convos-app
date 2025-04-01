import React, { memo, useEffect } from "react"
import { Center } from "@/design-system/Center"
import { AnimatedHStack, IAnimatedHStackProps } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { IIconProps } from "@/design-system/Icon/Icon.types"
import { Loader } from "@/design-system/loader"
import { AnimatedText } from "@/design-system/Text"
import { useIsLatestMessageByCurrentUser } from "@/features/conversation/conversation-chat/conversation-message/hooks/use-message-is-latest-sent-by-current-user"
import { useConversationMessageById } from "@/features/conversation/conversation-chat/conversation-message/use-conversation-message-by-id"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { usePrevious } from "@/hooks/use-previous-value"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/use-app-theme"
import { Haptics } from "@/utils/haptics"

type IConversationMessageStatusProps = {
  messageId: IXmtpMessageId
}

export const ConversationMessageStatus = memo(function ConversationMessageStatus({
  messageId,
}: IConversationMessageStatusProps) {
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const isLatestMessageByCurrentUser = useIsLatestMessageByCurrentUser(messageId)

  const { message } = useConversationMessageById({
    messageId,
    xmtpConversationId,
  })

  const previousStatus = usePrevious(message?.status)

  useEffect(() => {
    // Haptic when message is sent
    if (previousStatus === "sending" && message?.status === "sent") {
      Haptics.softImpactAsync()
    }
  }, [previousStatus, message?.status])

  if (!message) {
    return null
  }

  if (!isLatestMessageByCurrentUser) {
    return null
  }

  if (message.status === "sending") {
    return <SendingStatus />
  }

  if (message.status === "sent") {
    return <SentStatus animateEntering={previousStatus === "sending"} />
  }

  return null
})

const StatusContainer = memo(function StatusContainer(props: IAnimatedHStackProps) {
  const { children, style, ...rest } = props

  const { theme } = useAppTheme()

  return (
    <AnimatedHStack
      // {...debugBorder()}
      entering={theme.animation.reanimatedFadeInSpring}
      style={[
        {
          alignItems: "center",
          columnGap: theme.spacing.xxxs,
          paddingTop: theme.spacing.xxxs,
          paddingBottom: theme.spacing.xxxs,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </AnimatedHStack>
  )
})

const StatusText = memo(function StatusText({ text }: { text: string }) {
  return (
    <AnimatedText color="secondary" size="xxs">
      {text}
    </AnimatedText>
  )
})

const StatusIconContainer = memo(function StatusIconContainer({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <Center
      style={{
        width: 14, // Value from Figma
        height: 14, // Value from Figma
        padding: 1, // Value from Figma
      }}
    >
      {children}
    </Center>
  )
})

const SendingStatus = memo(function SendingStatus() {
  return (
    <StatusContainer>
      <StatusText text="Sending" />
      <StatusIconContainer>
        <Loader size="xxs" />
      </StatusIconContainer>
    </StatusContainer>
  )
})

const SentStatus = memo(function SentStatus({ animateEntering }: { animateEntering: boolean }) {
  const { theme } = useAppTheme()

  return (
    <StatusContainer
      // 300 delay for better UX so that the message entering animation finishes before showing the sent status
      entering={animateEntering ? theme.animation.reanimatedFadeInSpring.delay(1000) : undefined}
    >
      <StatusText text={translate("message_status.sent")} />
      <StatusIconContainer>
        <StatusIcon icon="checkmark" />
      </StatusIconContainer>
    </StatusContainer>
  )
})

const StatusIcon = memo(function StatusIcon(props: IIconProps) {
  const { theme } = useAppTheme()
  return <Icon size={theme.iconSize.xs} color={theme.colors.text.secondary} {...props} />
})
