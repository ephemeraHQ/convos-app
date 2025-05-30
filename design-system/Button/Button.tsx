import { Icon } from "@design-system/Icon/Icon"
import { IIconSizeKey } from "@theme/icon"
import { useCallback, useMemo } from "react"
import {
  GestureResponderEvent,
  Pressable,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native"
import { Loader } from "@/design-system/loader"
import { useAppTheme } from "@/theme/use-app-theme"
import { Haptics } from "../../utils/haptics"
import { Text } from "../Text"
import { IButtonProps, IButtonVariant } from "./Button.props"
import {
  $buttonLeftAccessoryStyle,
  $buttonRightAccessoryStyle,
  getButtonTextStyle,
  getButtonViewStyle,
} from "./Button.styles"

export function Button(props: IButtonProps) {
  const {
    tx,
    text,
    txOptions,
    style: $viewStyleOverride,
    pressedStyle: $pressedViewStyleOverride,
    textStyle: $textStyleOverride,
    pressedTextStyle: $pressedTextStyleOverride,
    disabledTextStyle: $disabledTextStyleOverride,
    children,
    RightAccessory,
    LeftAccessory,
    disabled,
    disabledStyle: $disabledViewStyleOverride,
    size = "lg",
    loading,
    withHapticFeedback = true,
    onPress,
    icon,
    // @deprecated,
    title,
    picto,
    loaderProps,
    ...rest
  } = props

  const { themed, theme } = useAppTheme()

  const variant: IButtonVariant = props.variant ?? "fill"

  const $viewStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => {
      return [
        themed(getButtonViewStyle({ variant, size, action: "primary", pressed, disabled })),
        $viewStyleOverride,
        pressed && $pressedViewStyleOverride,
        disabled && $disabledViewStyleOverride,
      ]
    },
    [
      themed,
      variant,
      size,
      $viewStyleOverride,
      $pressedViewStyleOverride,
      $disabledViewStyleOverride,
      disabled,
    ],
  )

  const $textStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<TextStyle> => {
      return [
        themed(getButtonTextStyle({ variant, size, action: "primary", pressed })),
        $textStyleOverride,
        pressed && $pressedTextStyleOverride,
        disabled && $disabledTextStyleOverride,
      ]
    },
    [
      themed,
      variant,
      size,
      $textStyleOverride,
      $pressedTextStyleOverride,
      $disabledTextStyleOverride,
      disabled,
    ],
  )

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (withHapticFeedback) {
        Haptics.softImpactAsync()
      }
      onPress?.(e)
    },
    [withHapticFeedback, onPress],
  )

  const _icon = icon ?? picto

  const iconSize = useMemo((): IIconSizeKey => {
    if (size === "lg") {
      return "sm"
    }
    return "xs"
  }, [size])

  const defaultLoaderColor = useMemo(() => {
    if (variant === "fill") {
      return theme.colors.text.inverted.primary
    }
    return theme.colors.text.primary
  }, [variant, theme.colors.text])

  return (
    <Pressable
      style={$viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={handlePress}
      disabled={disabled}
      {...rest}
    >
      {(state) => {
        if (loading) {
          return <Loader color={defaultLoaderColor} size="xs" {...loaderProps} />
        }

        return (
          <>
            {!!LeftAccessory && (
              <LeftAccessory
                style={$buttonLeftAccessoryStyle}
                pressableState={state}
                disabled={disabled}
              />
            )}

            {/* @deprecated stuff */}
            {!!_icon && (
              <Icon
                icon={_icon}
                size={theme.iconSize[iconSize]}
                color={
                  variant === "text" || variant === "link"
                    ? theme.colors.text.primary
                    : theme.colors.text.inverted.primary
                }
                style={themed($buttonLeftAccessoryStyle)}
              />
            )}

            <Text tx={tx} text={title ?? text} txOptions={txOptions} style={$textStyle(state)}>
              {children}
            </Text>

            {!!RightAccessory && (
              <RightAccessory
                style={$buttonRightAccessoryStyle}
                pressableState={state}
                disabled={disabled}
              />
            )}
          </>
        )
      }}
    </Pressable>
  )
}
