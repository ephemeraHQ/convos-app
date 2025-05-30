import { ReactElement } from "react"
import { View, ViewStyle } from "react-native"
import { IIconName } from "@/design-system/Icon/Icon.types"
import { translate } from "@/i18n"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { Icon } from "../Icon/Icon"
import { Loader } from "../loader"
import { Pressable } from "../Pressable"
import { ITextProps, Text } from "../Text"
import { ITouchableOpacityProps, TouchableOpacity } from "../TouchableOpacity"

type HeaderActionProps = {
  backgroundColor?: string
  icon?: IIconName
  iconColor?: string
  text?: ITextProps["text"]
  tx?: ITextProps["tx"]
  txOptions?: ITextProps["txOptions"]
  onPress?: ITouchableOpacityProps["onPress"]
  ActionComponent?: ReactElement
  style?: ViewStyle
  disabled?: boolean
  isLoading?: boolean
}
export function HeaderAction(props: HeaderActionProps) {
  const {
    backgroundColor,
    icon,
    text,
    tx,
    txOptions,
    onPress,
    ActionComponent,
    iconColor,
    style,
    disabled,
    isLoading,
  } = props
  const { themed, theme } = useAppTheme()

  const content = tx ? translate(tx, txOptions) : text

  if (ActionComponent) return ActionComponent

  if (content) {
    return (
      <TouchableOpacity
        style={[themed([$actionTextContainer, { backgroundColor }]), style]}
        onPress={onPress}
        disabled={disabled || isLoading || !onPress}
        activeOpacity={0.8}
        hitSlop={theme.spacing.xxxs}
      >
        <View style={themed($contentContainer)}>
          {isLoading && <Loader size="xs" style={themed($loader)} />}
          <Text preset="body" text={content} disabled={isLoading || disabled} />
        </View>
      </TouchableOpacity>
    )
  }

  if (icon) {
    return (
      <Pressable
        // {...debugBorder()}
        onPress={onPress}
        disabled={disabled || isLoading || !onPress}
        style={[themed([$actionIconContainer, { backgroundColor }]), style]}
        hitSlop={theme.spacing.xxxs}
      >
        {isLoading ? (
          <Loader size="xs" style={themed($loader)} />
        ) : (
          <Icon size={theme.iconSize.md} icon={icon} color={iconColor} />
        )}
      </Pressable>
    )
  }

  return <View style={[themed($actionFillerContainer), { backgroundColor }, style]} />
}

const $actionTextContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 0,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: spacing.md,
  zIndex: 2,
})

const $contentContainer: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
})

const $loader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginRight: spacing.xxs,
})

const $actionIconContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 0,
  alignItems: "center",
  justifyContent: "center",
  height: spacing.xxl,
  width: spacing.xxl,
  zIndex: 2,
})

const $actionFillerContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: spacing.xxs,
})
