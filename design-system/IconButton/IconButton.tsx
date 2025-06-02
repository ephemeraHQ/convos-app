import { Haptics } from "@utils/haptics"
import React, { useCallback } from "react"
import {
  GestureResponderEvent,
  PressableStateCallbackType,
  StyleProp,
  ViewStyle,
} from "react-native"
import { useAppTheme } from "../../theme/use-app-theme"
import { Icon } from "../Icon/Icon"
import { Loader } from "../loader"
import { Pressable } from "../Pressable"
import { IIconButtonProps } from "./IconButton.props"
import { getIconButtonViewStyle, getIconProps } from "./IconButton.styles"

export const IconButton = React.forwardRef(function IconButton(props: IIconButtonProps, ref) {
  const {
    icon,
    iconName,
    iconWeight,
    iconSize,
    variant = "fill",
    size = "md",
    action = "primary",
    style: styleOverride,
    pressedStyle: pressedStyleOverride,
    disabledStyle: disabledStyleOverride,
    disabled,
    isLoading = false,
    withHaptics = true,
    preventDoubleTap = false,
    onPress,
    ...rest
  } = props

  const { theme, themed } = useAppTheme()

  const viewStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      themed(
        getIconButtonViewStyle({
          variant,
          size,
          action,
          pressed,
          disabled: disabled || isLoading,
        }),
      ),
      styleOverride,
      pressed && pressedStyleOverride,
      (disabled || isLoading) && disabledStyleOverride,
    ],
    [
      themed,
      variant,
      size,
      action,
      disabled,
      isLoading,
      styleOverride,
      pressedStyleOverride,
      disabledStyleOverride,
    ],
  )

  const iconProps = useCallback(
    ({ pressed }: PressableStateCallbackType) =>
      themed(
        getIconProps({
          variant,
          size,
          action,
          pressed,
          disabled: disabled || isLoading,
        }),
      ),
    [themed, variant, size, action, disabled, isLoading],
  )

  const getLoaderSize = useCallback(() => {
    const sizeMap = {
      sm: "xs" as const,
      md: "sm" as const,
      lg: "md" as const,
      xl: "lg" as const,
    }
    return sizeMap[size]
  }, [size])

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled || isLoading) {
        return
      }

      if (withHaptics) {
        Haptics.softImpactAsync()
      }
      onPress?.(e)
    },
    [withHaptics, onPress, disabled, isLoading],
  )

  return (
    <Pressable
      style={viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || isLoading) }}
      disabled={disabled || isLoading}
      onPress={handlePress}
      hitSlop={theme.spacing.xxs}
      preventDoubleTap={preventDoubleTap}
      {...rest}
    >
      {({ pressed }) => {
        if (isLoading) {
          const { color } = iconProps({ pressed })
          return <Loader size={getLoaderSize()} color={color} />
        }

        if (iconName) {
          const { size, weight, color } = iconProps({ pressed })
          return (
            <Icon
              icon={iconName}
              color={color}
              weight={iconWeight || weight}
              size={iconSize || size}
            />
          )
        }

        return icon
      }}
    </Pressable>
  )
})
