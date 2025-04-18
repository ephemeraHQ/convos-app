import { Image } from "expo-image"
import React, { useCallback, useEffect, useState } from "react"
import { Modal } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import { Easing, runOnJS, useSharedValue, withTiming } from "react-native-reanimated"
// Import from our separated files
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { AnimatedHStack, HStack } from "@/design-system/HStack"
import { Text } from "@/design-system/Text"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
import { useAppTheme } from "@/theme/use-app-theme"
import { getRelativeDateTime, normalizeTimestampToMs } from "@/utils/date"
import { useConversationMediaViewAnimatedStyles } from "./conversation-media-viewer.animations"
import { CONVERSATION_MEDIA_VIEWER_CONSTANTS } from "./conversation-media-viewer.constants"
import { useConversationMediaViewerGestureHandlers } from "./conversation-media-viewer.gestures"
import {
  $animatedImageContainer,
  $container,
  $image,
  $imageContainer,
  $infoContainer,
} from "./conversation-media-viewer.styles"
import { IAnimationState, IMediaViewerProps } from "./conversation-media-viewer.types"

export const MediaViewer = function MediaViewer(props: IMediaViewerProps) {
  const { visible, onClose, uri, sender, timestamp } = props
  const { theme, themed } = useAppTheme()

  const [modalVisible, setModalVisible] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(false)

  // Initialize shared values directly in the component
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const backgroundOpacity = useSharedValue(0)
  const controlsOpacity = useSharedValue(0)
  const transitionProgress = useSharedValue(0)
  const isAnimatingTransition = useSharedValue(false)
  const isDismissing = useSharedValue(false)
  const dismissAnimation = useSharedValue(0)

  // Group the shared values into the animation state object
  const animState: IAnimationState = {
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
    backgroundOpacity,
    controlsOpacity,
    transitionProgress,
    isAnimatingTransition,
    isDismissing,
    dismissAnimation,
  }

  // Create our animation styles
  const {
    imageTransitionStyle,
    backgroundAnimatedStyle,
    controlsAnimatedStyle,
    gestureEnabledStyle,
  } = useConversationMediaViewAnimatedStyles(animState)

  // Factorized reset function to avoid repetition
  const resetSharedValues = useCallback(
    (setTransitionState = true) => {
      // Position values
      scale.value = 1
      savedScale.value = 1
      translateX.value = 0
      translateY.value = 0
      savedTranslateX.value = 0
      savedTranslateY.value = 0

      // Visibility values
      backgroundOpacity.value = 0
      controlsOpacity.value = 0

      // Transition values
      transitionProgress.value = 0
      isAnimatingTransition.value = setTransitionState

      // Dismissal values
      isDismissing.value = false
      dismissAnimation.value = 0
    },
    [
      scale,
      savedScale,
      translateX,
      translateY,
      savedTranslateX,
      savedTranslateY,
      backgroundOpacity,
      controlsOpacity,
      transitionProgress,
      isAnimatingTransition,
      isDismissing,
      dismissAnimation,
    ],
  )

  // Reset animation values when opening the viewer - now using the factorized function
  const resetAnimationValues = useCallback(() => {
    resetSharedValues(true)
  }, [resetSharedValues])

  // Handle effect when visibility changes
  useEffect(() => {
    if (visible) {
      // Force reset all animation values before showing
      resetAnimationValues()
      setModalVisible(true)
      setControlsVisible(false)

      // Ensure a small delay before starting animations to ensure reset is complete
      const animationTimer = setTimeout(() => {
        // Animate transition from bubble to fullscreen
        transitionProgress.value = withTiming(
          1,
          {
            duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          },
          () => {
            isAnimatingTransition.value = false
          },
        )

        // Fade in the background
        backgroundOpacity.value = withTiming(1, {
          duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
        })
      }, 50) // Small delay to ensure clean animation start

      return () => clearTimeout(animationTimer)
    }
  }, [visible, resetAnimationValues, backgroundOpacity, transitionProgress, isAnimatingTransition])

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    const newVisibility = !controlsVisible
    setControlsVisible(newVisibility)

    // Use withTiming with proper easing for smoother transition
    controlsOpacity.value = withTiming(newVisibility ? 1 : 0, {
      duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    })
  }, [controlsVisible, controlsOpacity])

  // Handle closing the modal with animation
  const handleClose = useCallback(() => {
    isAnimatingTransition.value = true

    // Hide controls immediately if visible
    if (controlsVisible) {
      setControlsVisible(false)
      controlsOpacity.value = 0
    }

    // Reset zoom and position
    scale.value = withTiming(1, {
      duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
    })
    translateX.value = withTiming(0, {
      duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
    })
    translateY.value = withTiming(0, {
      duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
    })

    // Animate back to source position
    transitionProgress.value = withTiming(0, {
      duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    })

    // Fade out the background
    backgroundOpacity.value = withTiming(
      0,
      {
        duration: CONVERSATION_MEDIA_VIEWER_CONSTANTS.TRANSITION_DURATION,
      },
      () => {
        runOnJS(setModalVisible)(false)
        runOnJS(onClose)()
      },
    )
  }, [
    controlsVisible,
    scale,
    translateX,
    translateY,
    transitionProgress,
    backgroundOpacity,
    controlsOpacity,
    isAnimatingTransition,
    onClose,
  ])

  // Also make sure the handleDismiss function properly resets state
  const handleDismiss = useCallback(() => {
    // Reset all animation values
    resetSharedValues(false)

    // Close the modal
    setModalVisible(false)
    onClose()
  }, [resetSharedValues, onClose])

  // Initialize gesture handlers
  const { combinedGestures } = useConversationMediaViewerGestureHandlers({
    animState,
    toggleControls,
    onDismiss: handleDismiss,
  })

  // Background color style
  const backgroundStyle = {
    backgroundColor: controlsVisible
      ? theme.colors.background.surfaceless
      : theme.colors.global.black,
  }

  return (
    <Modal
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleClose}
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <AnimatedVStack style={[$container, backgroundStyle, backgroundAnimatedStyle]}>
        {/* Image container */}
        <VStack style={$imageContainer}>
          <AnimatedVStack style={[$animatedImageContainer, gestureEnabledStyle]}>
            <GestureDetector gesture={combinedGestures}>
              <AnimatedVStack style={imageTransitionStyle}>
                <Image
                  source={{ uri }}
                  style={$image}
                  contentFit="contain"
                  transition={0}
                  cachePolicy="memory-disk"
                  recyclingKey={uri}
                />
              </AnimatedVStack>
            </GestureDetector>
          </AnimatedVStack>
        </VStack>

        {/* Controls container - only render when needed */}
        {(controlsVisible || controlsOpacity.value > 0) && (
          <AnimatedHStack style={[themed($infoContainer), controlsAnimatedStyle]}>
            <VStack>
              {sender && <Text preset="body">{sender}</Text>}
              {timestamp && (
                <Text preset="smaller" color="secondary">
                  {getRelativeDateTime(normalizeTimestampToMs(timestamp))}
                </Text>
              )}
            </VStack>
            <HeaderAction icon="xmark" onPress={handleClose} />
          </AnimatedHStack>
        )}
      </AnimatedVStack>
    </Modal>
  )
}
