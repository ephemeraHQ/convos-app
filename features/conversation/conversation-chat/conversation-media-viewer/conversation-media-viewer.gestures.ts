import { Gesture } from "react-native-gesture-handler"
import { Easing, interpolate, runOnJS, withSpring, withTiming } from "react-native-reanimated"
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/theme/layout"
import { CONVERSATION_MEDIA_VIEWER_CONSTANTS } from "./conversation-media-viewer.constants"
import { IGestureHandlerProps } from "./conversation-media-viewer.types"

export function useConversationMediaViewerGestureHandlers(props: IGestureHandlerProps) {
  const { animState, toggleControls, onDismiss } = props

  const {
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
    backgroundOpacity,
    isDismissing,
    dismissAnimation,
  } = animState

  const {
    SPRING_CONFIG,
    MAX_SCALE,
    MIN_SCALE_THRESHOLD,
    CLOSING_THRESHOLD,
    DISMISS_THRESHOLD,
    TRANSITION_DURATION,
  } = CONVERSATION_MEDIA_VIEWER_CONSTANTS

  // Pinch gesture for zooming with focal point
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      "worklet"
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
      
      // Ensure backgroundOpacity is 1 when starting a pinch gesture
      backgroundOpacity.value = 1
    })
    .onUpdate(
      (event: { scale: number; focalX: number; focalY: number; numberOfPointers: number }) => {
        "worklet"
        // Only handle updates with 2 pointers for smooth pinching
        if (event.numberOfPointers === 2) {
          // Immediately apply scale changes without waiting
          const newScale = Math.min(
            Math.max(savedScale.value * event.scale, MIN_SCALE_THRESHOLD),
            MAX_SCALE,
          )
          scale.value = newScale

          if (newScale > 1) {
            // Apply translation immediately for focal point zooming
            const pinchCenterX = event.focalX - SCREEN_WIDTH / 2
            const pinchCenterY = event.focalY - SCREEN_HEIGHT / 2

            // More responsive translation calculation
            let newTranslateX = savedTranslateX.value + pinchCenterX * (1 - event.scale)
            let newTranslateY = savedTranslateY.value + pinchCenterY * (1 - event.scale)

            // Enforce boundaries with elasticity during pinch
            const maxTranslateX = ((newScale - 1) * SCREEN_WIDTH) / 2
            const maxTranslateY = ((newScale - 1) * SCREEN_HEIGHT) / 2

            // Apply elastic behavior at the edges
            if (newTranslateX < -maxTranslateX) {
              const overscroll = -maxTranslateX - newTranslateX
              newTranslateX = -maxTranslateX - overscroll / 3
            } else if (newTranslateX > maxTranslateX) {
              const overscroll = newTranslateX - maxTranslateX
              newTranslateX = maxTranslateX + overscroll / 3
            }

            if (newTranslateY < -maxTranslateY) {
              const overscroll = -maxTranslateY - newTranslateY
              newTranslateY = -maxTranslateY - overscroll / 3
            } else if (newTranslateY > maxTranslateY) {
              const overscroll = newTranslateY - maxTranslateY
              newTranslateY = maxTranslateY + overscroll / 3
            }

            translateX.value = newTranslateX
            translateY.value = newTranslateY
          }
        }
      },
    )
    .onEnd(() => {
      "worklet"
      // Save state at the end of each gesture
      savedScale.value = scale.value
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value

      // If below threshold, trigger dismissal animation
      if (scale.value <= CLOSING_THRESHOLD && !isDismissing.value) {
        // Mark as dismissing to prevent multiple dismiss animations
        isDismissing.value = true

        // Use a separate animation value for the dismissal
        dismissAnimation.value = withTiming(
          1,
          {
            duration: TRANSITION_DURATION,
            easing: Easing.out(Easing.ease),
          },
          () => {
            runOnJS(onDismiss)()
          },
        )

        return
      }

      // Spring back to 1 if scale is between threshold and 1
      if (scale.value < 1) {
        scale.value = withSpring(1, SPRING_CONFIG)
        savedScale.value = 1
        translateX.value = withSpring(0, SPRING_CONFIG)
        translateY.value = withSpring(0, SPRING_CONFIG)
        savedTranslateX.value = 0
        savedTranslateY.value = 0
      } else if (scale.value > 1) {
        // When zoomed in, check boundaries and snap to edges if needed
        const maxTranslateX = ((scale.value - 1) * SCREEN_WIDTH) / 2
        const maxTranslateY = ((scale.value - 1) * SCREEN_HEIGHT) / 2

        let targetX = translateX.value
        let targetY = translateY.value

        // Check X bounds and adjust if needed
        if (translateX.value < -maxTranslateX) {
          targetX = -maxTranslateX
        } else if (translateX.value > maxTranslateX) {
          targetX = maxTranslateX
        }

        // Check Y bounds and adjust if needed
        if (translateY.value < -maxTranslateY) {
          targetY = -maxTranslateY
        } else if (translateY.value > maxTranslateY) {
          targetY = maxTranslateY
        }

        // Apply spring animation to snap to edges if needed
        if (targetX !== translateX.value) {
          translateX.value = withSpring(targetX, SPRING_CONFIG)
        }

        if (targetY !== translateY.value) {
          translateY.value = withSpring(targetY, SPRING_CONFIG)
        }

        // Update saved values
        savedScale.value = scale.value
        savedTranslateX.value = targetX
        savedTranslateY.value = targetY
      }
    })

  // Pan gesture for moving the image and dismissing
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(0) // Remove any activation delay
    .onStart((event) => {
      "worklet"
      // Only allow starting a pan when zoomed in, or when panning vertically to dismiss
      if (scale.value <= 1) {
        // Only allow vertical dismissal pans
        const isVerticalPan = Math.abs(event.velocityY) > Math.abs(event.velocityX)
        if (!isVerticalPan) {
          return false // Cancel the gesture if not vertical when not zoomed
        }
      }

      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
      return true
    })
    .onUpdate((event) => {
      "worklet"
      // When zoomed in, allow panning with restrictions
      if (scale.value > 1) {
        // Calculate the maximum allowed pan based on current scale
        const maxTranslateX = ((scale.value - 1) * SCREEN_WIDTH) / 2
        const maxTranslateY = ((scale.value - 1) * SCREEN_HEIGHT) / 2

        // Calculate new translation values
        let newTranslateX = savedTranslateX.value + event.translationX
        let newTranslateY = savedTranslateY.value + event.translationY

        // Apply elastic behavior at the edges
        if (newTranslateX < -maxTranslateX) {
          const overscroll = -maxTranslateX - newTranslateX
          newTranslateX = -maxTranslateX - overscroll / 3
        } else if (newTranslateX > maxTranslateX) {
          const overscroll = newTranslateX - maxTranslateX
          newTranslateX = maxTranslateX + overscroll / 3
        }

        if (newTranslateY < -maxTranslateY) {
          const overscroll = -maxTranslateY - newTranslateY
          newTranslateY = -maxTranslateY - overscroll / 3
        } else if (newTranslateY > maxTranslateY) {
          const overscroll = newTranslateY - maxTranslateY
          newTranslateY = maxTranslateY + overscroll / 3
        }

        translateX.value = newTranslateX
        translateY.value = newTranslateY
        
        // Ensure backgroundOpacity is 1 when zoomed in and panning
        backgroundOpacity.value = 1
      } else {
        // When at normal scale, only allow vertical drag to dismiss
        translateY.value = savedTranslateY.value + event.translationY

        // Fade background based on distance dragged
        const dragDistance = Math.abs(translateY.value)
        backgroundOpacity.value = interpolate(dragDistance, [0, DISMISS_THRESHOLD], [1, 0.3])

        // Allow very minimal horizontal movement, basically none
        translateX.value = savedTranslateX.value + event.translationX / 10
      }
    })
    .onEnd((event) => {
      "worklet"
      if (scale.value <= 1) {
        // Check if velocity or position is enough to dismiss
        const shouldDismiss =
          Math.abs(translateY.value) > DISMISS_THRESHOLD || Math.abs(event.velocityY) > 800

        if (shouldDismiss) {
          // Dismiss in the direction of movement
          const direction = translateY.value > 0 ? 1 : -1
          translateY.value = withTiming(direction * SCREEN_HEIGHT, {
            duration: TRANSITION_DURATION,
          })
          backgroundOpacity.value = withTiming(0, { duration: TRANSITION_DURATION }, () => {
            runOnJS(onDismiss)()
          })
        } else {
          // Spring back to center if not dismissed
          translateX.value = withSpring(0, SPRING_CONFIG)
          translateY.value = withSpring(0, SPRING_CONFIG)
          backgroundOpacity.value = withSpring(1, SPRING_CONFIG)
          savedTranslateX.value = 0
          savedTranslateY.value = 0
        }
      } else {
        // When zoomed in, check if the image is out of bounds and snap to edges
        const maxTranslateX = ((scale.value - 1) * SCREEN_WIDTH) / 2
        const maxTranslateY = ((scale.value - 1) * SCREEN_HEIGHT) / 2

        let targetX = translateX.value
        let targetY = translateY.value

        // Check X bounds and adjust if needed
        if (translateX.value < -maxTranslateX) {
          targetX = -maxTranslateX
        } else if (translateX.value > maxTranslateX) {
          targetX = maxTranslateX
        }

        // Check Y bounds and adjust if needed
        if (translateY.value < -maxTranslateY) {
          targetY = -maxTranslateY
        } else if (translateY.value > maxTranslateY) {
          targetY = maxTranslateY
        }

        // Apply spring animation to snap to edges
        translateX.value = withSpring(targetX, SPRING_CONFIG)
        translateY.value = withSpring(targetY, SPRING_CONFIG)

        // Update saved values
        savedTranslateX.value = targetX
        savedTranslateY.value = targetY
      }
    })

  // Single tap gesture to toggle controls
  const singleTapGesture = Gesture.Tap()
    .maxDuration(120)
    .onEnd(() => {
      "worklet"
      runOnJS(toggleControls)()
    })

  // Combine gestures with single tap only triggering when other gestures don't
  const combinedGestures = Gesture.Simultaneous(
    Gesture.Exclusive(singleTapGesture),
    pinchGesture,
    panGesture,
  )

  return { combinedGestures }
}
