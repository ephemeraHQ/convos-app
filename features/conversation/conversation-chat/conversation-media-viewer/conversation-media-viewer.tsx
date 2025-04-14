import React, { useCallback, useEffect, useState } from "react"
import { Modal, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { Text } from "@/design-system/Text"
import { Icon } from "@/design-system/Icon/Icon"
import { HStack } from "@/design-system/HStack"
import { PressableScale } from "@/design-system/pressable-scale"
import { useAppTheme } from "@/theme/use-app-theme"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated"

type IMediaViewerProps = {
  imageUri: string
  isVisible: boolean
  onClose: () => void
  sender?: string
  timestamp?: string
}

export const MediaViewer = ({
  imageUri,
  isVisible,
  onClose,
  sender = "",
  timestamp = "",
}: IMediaViewerProps) => {
  const { theme } = useAppTheme()
  const { height: windowHeight } = useWindowDimensions()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [scale, setScale] = useState(1)
  const [isReady, setIsReady] = useState(false)

  // Simple animation values without gestures for now
  const opacity = useSharedValue(1)

  // Reset values when modal closes
  const resetValues = useCallback(() => {
    setScale(1)
    setControlsVisible(true)
    opacity.value = 1
  }, [opacity])

  // Toggle controls visibility on tap
  const toggleControls = useCallback(() => {
    if (scale === 1) {
      setControlsVisible(prev => !prev)
    }
  }, [scale])

  // Handle tap to zoom
  const handleDoubleTap = useCallback(() => {
    if (scale === 1) {
      setScale(2)
    } else {
      setScale(1)
    }
  }, [scale])

  // Handle close with animation
  const handleClose = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)()
      runOnJS(resetValues)()
    })
  }, [onClose, resetValues, opacity])

  // Delay rendering of the animated components to avoid the host instance error
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure the modal is properly mounted
      const timer = setTimeout(() => {
        setIsReady(true)
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setIsReady(false)
    }
  }, [isVisible])

  // Animated styles
  const containerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(0, 0, 0, ${opacity.value})`,
    }
  })

  if (!isVisible) {
    return null
  }

  return (
    <Modal transparent onRequestClose={handleClose} animationType="fade" visible>
      <Animated.View style={[styles.container, containerStyle]}>
        <View 
          style={styles.imageContainer} 
          onTouchStart={toggleControls}
        >
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, { transform: [{ scale }] }]}
              contentFit="contain"
              recyclingKey={imageUri}
            />
          </View>
        </View>

        {/* Header - visible when controls are shown */}
        {controlsVisible && isReady && (
          <View style={styles.header}>
            <HStack style={{ justifyContent: "space-between", width: "100%" }}>
              <TouchableOpacity onPress={handleClose}>
                <Icon icon="xmark" size={24} color={theme.colors.fill.primary} />
              </TouchableOpacity>
              <Text preset="body" weight="bold" inverted>
                {sender}
              </Text>
              <View style={{ width: 24 }} />
            </HStack>
          </View>
        )}

        {/* Footer - visible when controls are shown */}
        {controlsVisible && isReady && (
          <View style={styles.footer}>
            <HStack style={{ justifyContent: "space-between", width: "100%" }}>
              <Text preset="small" inverted>{timestamp}</Text>
              
              <HStack style={{ gap: theme.spacing.md }}>
                {isReady && (
                  <>
                    <TouchableOpacity>
                      <Icon icon="arrowshape.turn.up.left" size={24} color={theme.colors.fill.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Icon icon="square.and.arrow.up" size={24} color={theme.colors.fill.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Icon icon="star" size={24} color={theme.colors.fill.primary} />
                    </TouchableOpacity>
                  </>
                )}
              </HStack>
            </HStack>
          </View>
        )}
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 50,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 30,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
}) 