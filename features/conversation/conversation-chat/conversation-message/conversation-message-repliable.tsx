// import { memo, useCallback, useMemo } from "react"
// import { Gesture, GestureDetector } from "react-native-gesture-handler"
// import Animated, {
//   interpolate,
//   runOnJS,
//   SharedValue,
//   useAnimatedReaction,
//   useAnimatedStyle,
//   useSharedValue,
//   withSpring,
// } from "react-native-reanimated"
// import { Icon } from "@/design-system/Icon/Icon"
// import { AnimatedVStack } from "@/design-system/VStack"
// import { useConversationComposerStore } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer.store-context"
// import { useConversationMessageStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
// import { useConversationMessageStyles } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.styles"
// import { SICK_SPRING_CONFIG } from "@/theme/animations"
// import { useAppTheme } from "@/theme/use-app-theme"
// import { Haptics } from "@/utils/haptics"

// type IProps = {
//   children: React.ReactNode
// }

// export const ConversationMessageRepliable = memo(function ConversationMessageRepliable({
//   children,
// }: IProps) {
//   return <CustomConversationMessageSwipeable>{children}</CustomConversationMessageSwipeable>
// })

// type ICustomConversationMessageSwipeableProps = {
//   children: React.ReactNode
// }

// // Distance needed to trigger the reply action
// const SWIPE_THRESHOLD = 20
// // Maximum distance the message can be swiped
// const MAX_SWIPE_DISTANCE = 80
// // How much to reduce the swipe sensitivity (higher = less sensitive)
// const SWIPE_FRICTION = 2

// export const CustomConversationMessageSwipeable = memo(function CustomConversationMessageSwipeable({
//   children,
// }: ICustomConversationMessageSwipeableProps) {
//   const { theme } = useAppTheme()
//   const composerStore = useConversationComposerStore()
//   const conversationMessageStore = useConversationMessageStore()
//   const { messageContainerSidePadding, senderAvatarSize } = useConversationMessageStyles()

//   // Minimum distance from left edge to allow swipe (prevents back gesture conflict)
//   const LEFT_EDGE_EXCLUSION = messageContainerSidePadding + senderAvatarSize
//   const translateX = useSharedValue(0)
//   const progressAV = useSharedValue(0)
//   const isGestureAllowed = useSharedValue(true)

//   const handleSwipeComplete = useCallback(() => {
//     Haptics.successNotificationAsync()
//     const xmtpMessageId = conversationMessageStore.getState().currentMessageId
//     composerStore.getState().setReplyToMessageId(xmtpMessageId)

//     // Reset the values to the initial state
//     translateX.value = withSpring(0, SICK_SPRING_CONFIG)
//     progressAV.value = withSpring(0, SICK_SPRING_CONFIG)
//   }, [composerStore, conversationMessageStore, translateX, progressAV])

//   const panGesture = useMemo(
//     () =>
//       Gesture.Pan()
//         .activeOffsetX([25, 1000]) // Only horizontal activation - exactly like the official implementation
//         .onStart((event) => {
//           console.log("🟢 begin", event.x, event.y)
//           // Only check edge exclusion - nothing else
//           isGestureAllowed.value = event.x > LEFT_EDGE_EXCLUSION
//           console.log("🟢 isGestureAllowed:", isGestureAllowed.value)
//         })
//         .onUpdate((event) => {
//           console.log("🔵 update", event.translationX, event.translationY)

//           if (!isGestureAllowed.value) return

//           // Simple logic like the official implementation - no vertical checks
//           const translationX = event.translationX

//           // Only process positive (rightward) swipes
//           if (translationX <= 0) return

//           // Apply friction and clamp
//           const rawTranslation = translationX / SWIPE_FRICTION
//           translateX.value = Math.min(rawTranslation, MAX_SWIPE_DISTANCE)
//           progressAV.value = Math.min(translateX.value / SWIPE_THRESHOLD, 1)
//         })
//         .onEnd(() => {
//           console.log("🟡 end")

//           if (!isGestureAllowed.value) {
//             translateX.value = withSpring(0, SICK_SPRING_CONFIG)
//             progressAV.value = withSpring(0, SICK_SPRING_CONFIG)
//             return
//           }

//           const shouldTrigger = translateX.value >= SWIPE_THRESHOLD
//           if (shouldTrigger) {
//             runOnJS(handleSwipeComplete)()
//           } else {
//             translateX.value = withSpring(0, SICK_SPRING_CONFIG)
//             progressAV.value = withSpring(0, SICK_SPRING_CONFIG)
//           }
//         }),
//     [handleSwipeComplete, progressAV, translateX, isGestureAllowed, LEFT_EDGE_EXCLUSION],
//   )

//   const containerAnimatedStyle = useAnimatedStyle(() => ({
//     transform: [{ translateX: translateX.value }],
//   }))

//   const leftActionAnimatedStyle = useAnimatedStyle(() => ({
//     opacity: interpolate(progressAV.value, [0, 0.3, 1], [0, 0, 1]),
//     transform: [{ scale: interpolate(progressAV.value, [0, 0.5, 1], [0.5, 0.8, 1]) }],
//   }))

//   return (
//     <GestureDetector gesture={panGesture}>
//       <Animated.View style={{ overflow: "hidden" }}>
//         <Animated.View
//           style={[
//             {
//               position: "absolute",
//               left: 0,
//               top: 0,
//               bottom: 0,
//               width: MAX_SWIPE_DISTANCE,
//               justifyContent: "center",
//               alignItems: "flex-start",
//               paddingLeft: theme.spacing.md,
//             },
//             leftActionAnimatedStyle,
//           ]}
//         >
//           <ConversationMessageSwipeReplyAction progressAV={progressAV} />
//         </Animated.View>
//         <Animated.View style={containerAnimatedStyle}>{children}</Animated.View>
//       </Animated.View>
//     </GestureDetector>
//   )
// })

// const ConversationMessageSwipeReplyAction = memo(function ConversationMessageSwipeReplyAction({
//   progressAV,
// }: {
//   progressAV: SharedValue<number>
// }) {
//   const { theme } = useAppTheme()

//   // Trigger haptic feedback when reaching full progress
//   useAnimatedReaction(
//     () => progressAV.value,
//     (currentProgress, previousProgress) => {
//       if (currentProgress >= 1 && (!previousProgress || previousProgress < 1)) {
//         Haptics.softImpactAsyncAnimated()
//       }
//     },
//   )

//   return (
//     <AnimatedVStack
//       style={{
//         justifyContent: "center",
//         alignItems: "center",
//       }}
//     >
//       <Icon size={theme.iconSize.sm} icon="arrowshape.turn.up.left.fill" />
//     </AnimatedVStack>
//   )
// })

import { Icon } from "@design-system/Icon/Icon"
import { Haptics } from "@utils/haptics"
import { memo, useCallback } from "react"
import {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"
import { ISwipeableRenderActionsArgs, Swipeable } from "@/components/swipeable"
import { AnimatedVStack } from "@/design-system/VStack"
import { useConversationComposerStore } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer.store-context"
import { useConversationMessageStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useConversationMessageStyles } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { logger } from "@/utils/logger/logger"

type IProps = {
  children: React.ReactNode
}

export const ConversationMessageRepliable = memo(function ConversationMessageRepliable({
  children,
}: IProps) {
  const { theme } = useAppTheme()

  const { messageContainerSidePadding, senderAvatarSize } = useConversationMessageStyles()

  const composerStore = useConversationComposerStore()
  const conversationMessageStore = useConversationMessageStore()

  const handleLeftSwipe = useCallback(() => {
    logger.debug("[ConversationMessageRepliable] onLeftSwipe")
    Haptics.successNotificationAsync()
    const xmtpMessageId = conversationMessageStore.getState().currentMessageId
    composerStore.getState().setReplyToMessageId(xmtpMessageId)
  }, [composerStore, conversationMessageStore])

  const renderLeftActions = useCallback(
    (args: ISwipeableRenderActionsArgs) => <SwipeReplyLeftAction {...args} />,
    [],
  )

  return (
    <Swipeable
      closeOnOpen
      overshootFriction={10} // 10 feels like the iMessage reply swipe so we like it!
      // Prevent swipe conflict with back gesture for other users' messages
      leftHitSlop={-messageContainerSidePadding - senderAvatarSize}
      dragOffsetFromLeftEdge={theme.spacing.xs}
      onLeftSwipe={handleLeftSwipe}
      renderLeftActions={renderLeftActions}
    >
      {children}
    </Swipeable>
  )
})

const SwipeReplyLeftAction = memo(function SwipeReplyLeftAction({
  progressAnimatedValue,
}: ISwipeableRenderActionsArgs) {
  const { theme } = useAppTheme()

  const containerWidthAV = useSharedValue(0)

  // Trigger haptic feedback when we reached 100% of box width
  useAnimatedReaction(
    () => progressAnimatedValue.value,
    (progress, previousProgress) => {
      if (progress > 1 && (!previousProgress || previousProgress <= 1)) {
        Haptics.softImpactAsyncAnimated()
      }
    },
  )

  const as = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progressAnimatedValue.value, [0, 0.7, 1], [0, 0, 1]),
      transform: [
        {
          scale: interpolate(progressAnimatedValue.value, [0, 0.7, 1], [0, 0, 1], "clamp"),
        },
        {
          translateX: interpolate(progressAnimatedValue.value, [0, 0.8, 1], [0, 0, 0], "clamp"),
        },
      ],
    }
  })

  return (
    <AnimatedVStack
      onLayout={({ nativeEvent }) => {
        containerWidthAV.value = nativeEvent.layout.width
      }}
      style={[
        {
          height: "100%",
          justifyContent: "center",
          paddingLeft: theme.spacing.sm,
        },
        as,
      ]}
    >
      <Icon size={theme.iconSize.sm} icon="arrowshape.turn.up.left.fill" />
    </AnimatedVStack>
  )
})
