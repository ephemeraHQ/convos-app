import { memo } from "react"
import { AnimatedHStack, IAnimatedHStackProps } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { IIconProps } from "@/design-system/Icon/Icon.types"
import { ITextProps, Text } from "@/design-system/Text"
import { IVStackProps, VStack } from "@/design-system/VStack"
import { useConversationListStyles } from "@/features/conversation/conversation-list/conversation-list.styles"
import { useAppTheme } from "@/theme/use-app-theme"

export const BannerContainer = memo(function BannerContainer(props: IAnimatedHStackProps) {
  const { children, ...rest } = props
  const { theme } = useAppTheme()
  const { screenHorizontalPadding } = useConversationListStyles()
  const { style, ...restProps } = rest

  return (
    <AnimatedHStack
      entering={theme.animation.reanimatedFadeInSpring}
      exiting={theme.animation.reanimatedFadeOutSpring}
      style={[
        {
          backgroundColor: theme.colors.fill.minimal,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.lg,
          borderRadius: theme.borderRadius.xxs,
          columnGap: theme.spacing.sm,
          alignItems: "center",
          marginHorizontal: screenHorizontalPadding,
          marginBottom: theme.spacing.xs,
        },
        style,
      ]}
      {...restProps}
    >
      {children}
    </AnimatedHStack>
  )
})

export const BannerTitle = memo(function BannerTitle(props: ITextProps) {
  return <Text preset="body" {...props} />
})

export const BannerSubtitle = memo(function BannerSubtitle(props: ITextProps) {
  return <Text color="secondary" preset="small" {...props} />
})

export const BannerContentContainer = memo(function BannerContentContainer(props: IVStackProps) {
  const { style, ...rest } = props
  const { theme } = useAppTheme()
  return <VStack style={[{ rowGap: theme.spacing.xxxs, flex: 1 }, style]} {...rest} />
})

export const BannerIcon = memo(function BannerIcon(props: IIconProps) {
  const { theme } = useAppTheme()
  return <Icon size={theme.iconSize.md} color={theme.colors.text.secondary} {...props} />
})
