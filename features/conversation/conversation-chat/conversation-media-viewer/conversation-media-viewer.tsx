import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Modal, TouchableOpacity, View, Dimensions, ViewStyle, ImageStyle } from 'react-native'
import { Image } from "expo-image"
import { Text } from "@/design-system/Text"
import { Icon } from "@/design-system/Icon/Icon"
import { useAppTheme, ThemedStyle } from "@/theme/use-app-theme"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  withSpring,
  interpolate,
  withDecay,
} from 'react-native-reanimated'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Constants for animations
const MAX_SCALE = 4
const MIN_SCALE_THRESHOLD = 0.2
const SPRING_CONFIG = {
  damping: 15,
  mass: 1,
  stiffness: 150,
  overshootClamping: false,
}
const DISMISS_THRESHOLD = 120 // Distance to dismiss in pixels

export type IMediaViewerProps = {
  visible: boolean
  onClose: () => void
  uri: string
  sender?: string
  timestamp?: string
  formatTimestamp?: (timestamp: string) => string
}

export const MediaViewer = function MediaViewer(props: IMediaViewerProps) {
  const { visible, onClose, uri, sender, timestamp, formatTimestamp } = props
  
  const { theme, themed } = useAppTheme()

  const [modalVisible, setModalVisible] = useState(false)

  // Shared animation values
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const backgroundOpacity = useSharedValue(1)
  
  // Reset animation values when opening the viewer
  const resetAnimationValues = useCallback(() => {
    scale.value = 1
    savedScale.value = 1
    translateX.value = 0
    translateY.value = 0
    savedTranslateX.value = 0
    savedTranslateY.value = 0
    backgroundOpacity.value = 1
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY, backgroundOpacity])

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      resetAnimationValues()
    }
  }, [visible, resetAnimationValues])

  // Handle closing the modal with animation
  const handleClose = () => {
    scale.value = withTiming(1, { duration: 150 })
    translateX.value = withTiming(0, { duration: 150 })
    translateY.value = withTiming(0, { duration: 150 })
    backgroundOpacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(setModalVisible)(false)
      runOnJS(onClose)()
    })
  }

  // Pinch gesture for zooming with focal point - defined without refs to improve performance
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((event: { scale: number; focalX: number; focalY: number }) => {
      'worklet';
      // Immediately apply scale changes without waiting
      const newScale = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE_THRESHOLD), MAX_SCALE)
      scale.value = newScale
      
      if (newScale > 1) {
        // Apply translation immediately for focal point zooming
        const pinchCenterX = event.focalX - SCREEN_WIDTH / 2
        const pinchCenterY = event.focalY - SCREEN_HEIGHT / 2
        
        // More responsive translation calculation
        let newTranslateX = savedTranslateX.value + pinchCenterX * (1 - event.scale)
        let newTranslateY = savedTranslateY.value + pinchCenterY * (1 - event.scale)
        
        // Enforce boundaries with elasticity during pinch
        const maxTranslateX = (newScale - 1) * SCREEN_WIDTH / 2
        const maxTranslateY = (newScale - 1) * SCREEN_HEIGHT / 2
        
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
    })
    .onEnd(() => {
      'worklet';
      // If below threshold, close the modal
      if (scale.value < MIN_SCALE_THRESHOLD) {
        runOnJS(handleClose)()
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
        const maxTranslateX = (scale.value - 1) * SCREEN_WIDTH / 2
        const maxTranslateY = (scale.value - 1) * SCREEN_HEIGHT / 2
        
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
      } else {
        // Just update saved values at normal scale
        savedScale.value = scale.value
        savedTranslateX.value = translateX.value
        savedTranslateY.value = translateY.value
      }
    })

  // Pan gesture for moving the image and dismissing
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(0) // Remove any activation delay
    .onStart((event) => {
      'worklet';
      // Only allow starting a pan when zoomed in, or when panning vertically to dismiss
      if (scale.value <= 1) {
        // Only allow vertical dismissal pans
        const isVerticalPan = Math.abs(event.velocityY) > Math.abs(event.velocityX);
        if (!isVerticalPan) {
          return false; // Cancel the gesture if not vertical when not zoomed
        }
      }
      
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
      return true;
    })
    .onUpdate((event) => {
      'worklet';
      // When zoomed in, allow panning with restrictions
      if (scale.value > 1) {
        // Calculate the maximum allowed pan based on current scale
        const maxTranslateX = (scale.value - 1) * SCREEN_WIDTH / 2
        const maxTranslateY = (scale.value - 1) * SCREEN_HEIGHT / 2
        
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
      } else {
        // When at normal scale, only allow vertical drag to dismiss
        translateY.value = savedTranslateY.value + event.translationY
        
        // Fade background based on distance dragged
        const dragDistance = Math.abs(translateY.value)
        backgroundOpacity.value = interpolate(
          dragDistance,
          [0, DISMISS_THRESHOLD],
          [1, 0.3]
        )
        
        // Allow very minimal horizontal movement, basically none
        translateX.value = savedTranslateX.value + event.translationX / 10
      }
    })
    .onEnd((event) => {
      'worklet';
      if (scale.value <= 1) {
        // Check if velocity or position is enough to dismiss
        const shouldDismiss = 
          Math.abs(translateY.value) > DISMISS_THRESHOLD || 
          Math.abs(event.velocityY) > 800
        
        if (shouldDismiss) {
          // Dismiss in the direction of movement
          const direction = translateY.value > 0 ? 1 : -1
          translateY.value = withTiming(direction * SCREEN_HEIGHT, { duration: 200 })
          backgroundOpacity.value = withTiming(0, { duration: 200 }, () => {
            runOnJS(setModalVisible)(false)
            runOnJS(onClose)()
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
        // When zoomed in, apply deceleration with bounds checking
        const maxTranslateX = (scale.value - 1) * SCREEN_WIDTH / 2
        const maxTranslateY = (scale.value - 1) * SCREEN_HEIGHT / 2
        
        // First, check if we're already out of bounds
        if (translateX.value < -maxTranslateX || translateX.value > maxTranslateX ||
            translateY.value < -maxTranslateY || translateY.value > maxTranslateY) {
          // If out of bounds, just snap to edges with spring
          let targetX = translateX.value
          let targetY = translateY.value
          
          if (translateX.value < -maxTranslateX) {
            targetX = -maxTranslateX
          } else if (translateX.value > maxTranslateX) {
            targetX = maxTranslateX
          }
          
          if (translateY.value < -maxTranslateY) {
            targetY = -maxTranslateY
          } else if (translateY.value > maxTranslateY) {
            targetY = maxTranslateY
          }
          
          translateX.value = withSpring(targetX, SPRING_CONFIG)
          translateY.value = withSpring(targetY, SPRING_CONFIG)
          savedTranslateX.value = targetX
          savedTranslateY.value = targetY
        } else {
          // Otherwise, apply deceleration with momentum
          // X-axis with deceleration
          translateX.value = withDecay({
            velocity: event.velocityX,
            deceleration: 0.992, // Higher value = less friction
            clamp: [-maxTranslateX, maxTranslateX], // Boundary constraints
            onFinish: (finished) => {
              'worklet';
              if (finished) {
                savedTranslateX.value = translateX.value
              }
            },
          })
          
          // Y-axis with deceleration
          translateY.value = withDecay({
            velocity: event.velocityY,
            deceleration: 0.992,
            clamp: [-maxTranslateY, maxTranslateY],
            onFinish: (finished) => {
              'worklet';
              if (finished) {
                savedTranslateY.value = translateY.value
              }
            },
          })
        }
      }
    })

  // Combined gestures - optimize for immediate response
  const combinedGestures = Gesture.Exclusive(
    Gesture.Simultaneous(
      pinchGesture,
      panGesture,
    )
  )

  // Animated styles for the image
  const animatedImageStyles = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ]
    }
  })
  
  // Animated styles for background opacity - ensure black background is visible
  const animatedBackgroundStyles = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(0, 0, 0, ${Math.max(0.9, backgroundOpacity.value * 0.9)})`,
    }
  })

  // Pre-calculate the info container animated style to avoid conditional hook calls
  const infoContainerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value
  }))

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
        <Animated.View style={[themed($container), animatedBackgroundStyles]}>
          <GestureDetector gesture={combinedGestures}>
            <Animated.View style={[$imageContainer, animatedImageStyles]}>
              <Image
                source={{ uri }}
                style={$image}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
              />
            </Animated.View>
          </GestureDetector>
          
          <TouchableOpacity
            style={themed($closeButton)}
            onPress={handleClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Icon icon="xmark" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          
          {(sender || timestamp) && (
            <Animated.View style={[themed($infoContainer), infoContainerAnimatedStyle]}>
              {sender && (
                <Text preset="body" weight="bold" color="primary">
                  {sender}
                </Text>
              )}
              {timestamp && (
                <Text preset="small" color="primary">
                  {formatTimestamp ? formatTimestamp(timestamp) : timestamp}
                </Text>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

// Convert styles to themed styles with $ prefix
const $container: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
})

const $imageContainer: ViewStyle = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  justifyContent: 'center',
  alignItems: 'center',
}

const $image: ImageStyle = {
  width: '100%',
  height: '100%',
}

const $closeButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: 'absolute',
  top: 40,
  right: 20,
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
})

const $infoContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  position: 'absolute',
  bottom: 40,
  left: 0,
  right: 0,
  padding: spacing.md,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  alignItems: 'center',
})
