import { AnimatedHStack, HStack } from "@design-system/HStack"
import { useMemo } from "react"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { useHasNextMessageInSeries } from "@/features/conversation/utils/has-next-message-in-serie"
import { useSelect } from "@/stores/stores.utils"
import { useAppTheme } from "@/theme/use-app-theme"

export const BubbleContainer = ({ children }: { children: React.ReactNode }) => {
  const { fromMe } = useConversationMessageContextSelector(useSelect(["fromMe"]))

  return (
    <HStack
      // {...debugBorder()}
      style={{
        ...(fromMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }),
      }}
    >
      {children}
    </HStack>
  )
}

type IBubbleContentContainerProps = {
  children: React.ReactNode
}

export const BubbleContentContainer = (args: IBubbleContentContainerProps) => {
  const { children } = args
  const { theme } = useAppTheme()

  const { fromMe } = useConversationMessageContextSelector(useSelect(["fromMe"]))

  const xmtpMessageId = useConversationMessageContextSelector((state) => state.xmtpMessageId)

  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { data: hasNextMessageInSeries } = useHasNextMessageInSeries({
    currentMessageId: xmtpMessageId,
    xmtpConversationId,
  })

  const bubbleStyle = useMemo(() => {
    const baseStyle = {
      backgroundColor: fromMe ? theme.colors.bubbles.bubble : theme.colors.bubbles.received.bubble,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      maxWidth: theme.layout.screen.width * 0.7,
    }

    if (!hasNextMessageInSeries) {
      return {
        ...baseStyle,
        borderBottomLeftRadius: fromMe ? theme.borderRadius.sm : theme.spacing["4xs"],
        borderBottomRightRadius: fromMe ? theme.spacing["4xs"] : theme.borderRadius.sm,
      }
    }

    return baseStyle
  }, [fromMe, hasNextMessageInSeries, theme])

  return <AnimatedHStack style={bubbleStyle}>{children}</AnimatedHStack>
}
