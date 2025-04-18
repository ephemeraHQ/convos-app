import { interpolate, interpolateColor, useAnimatedStyle } from "react-native-reanimated"
import { IAnimationState } from "./conversation-media-viewer.types"

/**
 * Custom hook for creating all animated styles needed for the media viewer
 */
export function useConversationMediaViewAnimatedStyles(animState: IAnimationState) {
  const {
    scale,
    translateX,
    translateY,
    backgroundOpacity,
    controlsOpacity,
    transitionProgress,
    isAnimatingTransition,
    isDismissing,
    dismissAnimation,
  } = animState

  // Image animation style with handling for different states
  const imageTransitionStyle = useAnimatedStyle(() => {
    // When dismissing via pinch, apply dismissal animation
    if (isDismissing.value) {
      // More dramatic dismissal animation
      return {
        opacity: interpolate(dismissAnimation.value, [0, 0.7, 1], [1, 0.7, 0]),
        transform: [
          { translateY: interpolate(dismissAnimation.value, [0, 1], [0, -80]) },
          {
            scale: interpolate(
              dismissAnimation.value,
              [0, 0.5, 1],
              [scale.value, scale.value * 0.7, 0],
            ),
          },
        ],
      }
    }

    // During entry/exit transitions
    if (isAnimatingTransition.value) {
      return {
        opacity: transitionProgress.value,
        transform: [{ scale: interpolate(transitionProgress.value, [0, 1], [0.5, 1]) }],
      }
    }

    // During normal interactions (pinch/pan)
    return {
      opacity: 1,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }
  })

  // Animation styles for modal background
  const backgroundAnimatedStyle = useAnimatedStyle(() => {
    // When dismissing via pinch
    if (isDismissing.value) {
      // Fade to black then disappear
      const backgroundColor = interpolateColor(
        dismissAnimation.value,
        [0, 0.5, 1],
        ["rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0)"],
      )

      return {
        opacity: 1,
        backgroundColor,
      }
    }

    // Normal background opacity
    return {
      opacity: backgroundOpacity.value,
    }
  })

  // Animation styles for controls
  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }))

  // Gesture enabled state based on transition
  const gestureEnabledStyle = useAnimatedStyle(() => ({
    pointerEvents: isAnimatingTransition.value ? "none" : "auto",
  }))

  return {
    imageTransitionStyle,
    backgroundAnimatedStyle,
    controlsAnimatedStyle,
    gestureEnabledStyle,
  }
}
