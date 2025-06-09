import { AnimatedHStack } from "@design-system/HStack"
import { AnimatedText, Text } from "@design-system/Text"
import { AnimatedVStack } from "@design-system/VStack"
import { SICK_DAMPING, SICK_STIFFNESS } from "@theme/animations"
import { getLocalizedTime, getRelativeDate } from "@utils/date"
import { isToday, isWithinInterval, subHours } from "date-fns"
import { memo, useEffect, useMemo } from "react"
import { ViewStyle } from "react-native"
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import {
  useConversationMessageContextSelector,
  useConversationMessageStore,
} from "./conversation-message.store-context"

export const ConversationMessageTimestamp = memo(function ConversationMessageTimestamp() {
  const shouldShowDateChange = useConversationMessageContextSelector((s) => s.showDateChange)
  const xmtpMessageId = useConversationMessageContextSelector((s) => s.currentMessageId)
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const currentSender = useSafeCurrentSender()
  const isShowingTime = useConversationMessageContextSelector((s) => s.isShowingTime)

  const { data: message } = useConversationMessageQuery({
    xmtpMessageId: xmtpMessageId,
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "ConversationMessageTimestamp",
  })

  if (!message) {
    return null
  }

  if (shouldShowDateChange) {
    return <ConversationMessageTimestampVisible timestampMs={message.sentMs} />
  }

  if (!isShowingTime) {
    return null
  }

  return <ConversationMessageTimestampHidden timestampMs={message.sentMs} />
})

// Determines if we should show only time (for messages less than 24h old)
function shouldShowOnlyTime(timestampMs: number): boolean {
  const messageDate = new Date(timestampMs)
  const now = new Date()

  return isWithinInterval(messageDate, {
    start: subHours(now, 24),
    end: now,
  })
}

// For messages that can be tapped to show time
const ConversationMessageTimestampVisible = memo(function ConversationMessageTimestampVisible({
  timestampMs,
}: {
  timestampMs: number
}) {
  const { theme } = useAppTheme()
  const showTimeAV = useSharedValue(0)
  const messageStore = useConversationMessageStore()

  const messageTime = getLocalizedTime(timestampMs)
  const showOnlyTime = shouldShowOnlyTime(timestampMs)
  const messageDate = showOnlyTime ? messageTime : getRelativeDate(timestampMs)

  useEffect(() => {
    const unsubscribe = messageStore.subscribe(
      (state) => state.isShowingTime,
      (isShowingTime) => {
        showTimeAV.value = isShowingTime ? 1 : 0
      },
    )
    return () => unsubscribe()
  }, [messageStore, showTimeAV])

  const timeAnimatedStyle = useAnimatedStyle(() => ({
    display: showTimeAV.value ? "flex" : "none",
    opacity: withSpring(showTimeAV.value ? 1 : 0, {
      damping: SICK_DAMPING,
      stiffness: SICK_STIFFNESS,
    }),
  }))

  return (
    <AnimatedHStack
      layout={theme.animation.reanimatedLayoutSpringTransition}
      style={{
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        columnGap: theme.spacing["4xs"],
        marginVertical: theme.spacing.sm,
      }}
    >
      <Text preset="smaller" color="secondary">
        {messageDate}
      </Text>
      {!showOnlyTime && (
        <AnimatedText preset="smaller" color="secondary" style={timeAnimatedStyle}>
          {messageTime}
        </AnimatedText>
      )}
    </AnimatedHStack>
  )
})

const ConversationMessageTimestampHidden = memo(function ConversationMessageTimestampHidden({
  timestampMs,
}: {
  timestampMs: number
}) {
  const { themed, theme } = useAppTheme()

  const $containerStyle = useMemo(() => themed($container), [themed])

  const messageTime = getLocalizedTime(timestampMs)
  const messageDate = isToday(timestampMs)
    ? messageTime
    : `${getRelativeDate(timestampMs)} ${messageTime}`

  return (
    <AnimatedVStack entering={theme.animation.reanimatedFadeInDownSpring} style={$containerStyle}>
      <Text preset="smaller" color="secondary">
        {messageDate}
      </Text>
    </AnimatedVStack>
  )
})

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  marginVertical: spacing.sm,
})
