import { ViewStyle } from "react-native"
import { ActivityIndicator } from "@/design-system/activity-indicator"
import { IButtonVariant } from "@/design-system/Button/Button.props"
import { IIconButtonProps } from "@/design-system/IconButton/IconButton.props"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { Button } from "@/design-system/Button/Button"

type IOnboardingFooterProps = {
  text: string
  onPress: () => void
  disabled?: boolean
  isLoading?: boolean
  iconButtonProps?: IIconButtonProps
  variant?: IButtonVariant
}

export function OnboardingFooter({
  text,
  onPress,
  disabled,
  isLoading,
  variant = "fill",
}: IOnboardingFooterProps) {
  const { theme, themed } = useAppTheme()

  return (
    <Button
      variant={variant}
      action="primary"
      disabled={disabled || isLoading}
      style={themed($buttonStyle)}
      textStyle={(disabled || isLoading) ? { opacity: 0.6 } : undefined}
      onPress={onPress}
      {...(isLoading
        ? { LeftAccessory: () => <ActivityIndicator color={theme.colors.text.primary} /> }
        : {})}
    >
      {!isLoading && text}
    </Button>
  )
}

const $buttonStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  marginHorizontal: spacing.lg,
})
