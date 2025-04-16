import React, { useEffect, useState, useCallback } from 'react'
import { Modal, TouchableOpacity, View } from 'react-native'
import { Image } from "expo-image"
import { Text } from "@/design-system/Text"
import { Icon } from "@/design-system/Icon/Icon"
import { useAppTheme } from "@/theme/use-app-theme"
import Animated, {
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { getRelativeDateTime, normalizeTimestampToMs } from "@/utils/date"

// Import from our separated files
import { IMediaViewerProps, VIEWER_CONSTANTS, IAnimationState } from './conversation-media-viewer.types'
import { useGestureHandlers } from './conversation-media-viewer.gestures'
import { useAnimatedStyles } from './conversation-media-viewer.animations'
import { 
  $container, 
  $imageContainer, 
  $image, 
  $animatedImageContainer,
  $closeButton,
  $infoContainer 
} from './conversation-media-viewer.styles'

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
    dismissAnimation
  }

  // Create our animation styles
  const { 
    imageTransitionStyle, 
    backgroundAnimatedStyle,
    controlsAnimatedStyle,
    gestureEnabledStyle
  } = useAnimatedStyles(animState)

  // Factorized reset function to avoid repetition
  const resetSharedValues = useCallback((setTransitionState = true) => {
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
  }, [
    scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY,
    backgroundOpacity, controlsOpacity, transitionProgress, isAnimatingTransition,
    isDismissing, dismissAnimation
  ])

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
        transitionProgress.value = withTiming(1, {
          duration: VIEWER_CONSTANTS.TRANSITION_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, () => {
          isAnimatingTransition.value = false
        })
        
        // Fade in the background
        backgroundOpacity.value = withTiming(1, { 
          duration: VIEWER_CONSTANTS.TRANSITION_DURATION 
        })
      }, 50) // Small delay to ensure clean animation start
      
      return () => clearTimeout(animationTimer)
    }
  }, [
    visible, 
    resetAnimationValues,
    backgroundOpacity,
    transitionProgress,
    isAnimatingTransition
  ])

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    const newVisibility = !controlsVisible
    setControlsVisible(newVisibility)
    
    // Use withTiming with proper easing for smoother transition
    controlsOpacity.value = withTiming(newVisibility ? 1 : 0, { 
      duration: VIEWER_CONSTANTS.TRANSITION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1)
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
    scale.value = withTiming(1, { duration: VIEWER_CONSTANTS.TRANSITION_DURATION })
    translateX.value = withTiming(0, { duration: VIEWER_CONSTANTS.TRANSITION_DURATION })
    translateY.value = withTiming(0, { duration: VIEWER_CONSTANTS.TRANSITION_DURATION })
    
    // Animate back to source position
    transitionProgress.value = withTiming(0, {
      duration: VIEWER_CONSTANTS.TRANSITION_DURATION,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    })
    
    // Fade out the background
    backgroundOpacity.value = withTiming(0, { 
      duration: VIEWER_CONSTANTS.TRANSITION_DURATION 
    }, () => {
      runOnJS(setModalVisible)(false)
      runOnJS(onClose)()
    })
  }, [
    controlsVisible,
    scale,
    translateX,
    translateY,
    transitionProgress,
    backgroundOpacity,
    controlsOpacity,
    isAnimatingTransition,
    onClose
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
  const { combinedGestures } = useGestureHandlers({
    animState,
    toggleControls,
    onDismiss: handleDismiss
  })

  // Background color style
  const backgroundStyle = { 
    backgroundColor: controlsVisible 
      ? theme.colors.background.surfaceless 
      : theme.colors.global.black,
  }

  // Add a cleanup effect to ensure state is reset when component unmounts
  useEffect(() => {
    // Reset all states when component unmounts
    return () => resetSharedValues(false)
  }, [resetSharedValues]) // Now just depends on the factorized function

  return (
    <Modal
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleClose}
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View 
          style={[
            $container,
            backgroundStyle,
            backgroundAnimatedStyle
          ]}
        >
          {/* Image container */}
          <View style={$imageContainer}>
            <Animated.View style={[
              $animatedImageContainer, 
              gestureEnabledStyle
            ]}>
              <GestureDetector gesture={combinedGestures}>
                <Animated.View style={imageTransitionStyle}>
                  <Image
                    source={{ uri }}
                    style={$image}
                    contentFit="contain"
                    transition={0}
                    cachePolicy="memory-disk"
                    recyclingKey={uri}
                  />
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          </View>
          
          {/* Controls container - only render when needed */}
          {(controlsVisible || controlsOpacity.value > 0) && (
            <Animated.View 
              style={[
                themed($infoContainer), 
                controlsAnimatedStyle,
              ]}
            >
              {sender && (
                <Text preset="body">
                  {sender}
                </Text>
              )}
              {timestamp && (
                <Text
                  preset="smaller"
                  color="secondary"
                >
                  {getRelativeDateTime(normalizeTimestampToMs(timestamp))}
                </Text>
              )}
              <TouchableOpacity
                style={themed($closeButton)}
                onPress={handleClose}
                hitSlop={20}
              >
                <Icon icon="xmark" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}
