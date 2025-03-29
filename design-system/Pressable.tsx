import { Haptics } from "@utils/haptics"
import { memo, useCallback, useRef } from "react"
import {
  GestureResponderEvent,
  Pressable as RNPressable,
  PressableProps as RNPressableProps,
} from "react-native"
import Animated from "react-native-reanimated"
import { useAppTheme } from "@/theme/use-app-theme"

export type IPressableProps = RNPressableProps & {
  withHaptics?: boolean
  preventDoubleTap?: boolean
}

export const Pressable = memo(function Pressable(props: IPressableProps) {
  const { withHaptics, onPress: onPressProps, preventDoubleTap = false, ...rest } = props

  const { theme } = useAppTheme()

  const isDisabled = useRef(false)

  const onPress = useCallback(
    (e: GestureResponderEvent) => {
      if (preventDoubleTap && isDisabled.current) {
        return
      }

      if (preventDoubleTap) {
        isDisabled.current = true
        setTimeout(() => {
          isDisabled.current = false
        }, 300)
      }

      if (withHaptics) {
        Haptics.lightImpactAsync()
      }

      if (onPressProps) {
        onPressProps(e)
      }
    },
    [withHaptics, onPressProps, preventDoubleTap],
  )

  return (
    <RNPressable
      // By default we love a bigger hit area
      hitSlop={theme.spacing.sm}
      onPress={onPress}
      {...rest}
    />
  )
})

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
