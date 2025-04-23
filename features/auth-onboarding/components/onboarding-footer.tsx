import { ViewStyle } from "react-native"
import { ActivityIndicator } from "@/design-system/activity-indicator"
import { IIconButtonProps } from "@/design-system/IconButton/IconButton.props"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { Button } from "@/design-system/Button/Button"

type IOnboardingFooterProps = {
  text: string
  onPress: () => void
  disabled?: boolean
  isLoading?: boolean
  iconButtonProps?: IIconButtonProps
}

export function OnboardingFooter({
  text,
  onPress,
  disabled,
  isLoading,
}: IOnboardingFooterProps) {
  const { themed } = useAppTheme()

  return (
    <Button
      action="primary"
      disabled={disabled || isLoading}
      style={themed($buttonStyle)}
      onPress={onPress}
      {...(isLoading
        ? { LeftAccessory: () => <ActivityIndicator color="white"/> }
        : {})}
    >
      {!isLoading && text}
    </Button>
  )
}

const $buttonStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginHorizontal: spacing.lg,
})
