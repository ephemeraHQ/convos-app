import React, { memo, useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { AnimatedCenter, Center } from "@/design-system/Center"
import { Icon } from "@/design-system/Icon/Icon"
import { ITextProps, Text } from "@/design-system/Text"
import { TouchableHighlight } from "@/design-system/touchable-highlight"
import { IVStackProps, VStack } from "@/design-system/VStack"
import { useConversationListStyles } from "@/features/conversation/conversation-list/conversation-list.styles"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"

export type IConversationListItemProps = {
  title?: string | React.ReactNode
  subtitle?: string | React.ReactNode
  avatarComponent?: React.ReactNode
  onPress?: () => void
  isUnread?: boolean
  showError?: boolean
  previewContainerProps?: IVStackProps
  isMuted?: boolean
}

export const ConversationListItem = memo(function ConversationListItem({
  onPress,
  isUnread,
  title,
  subtitle,
  avatarComponent,
  showError,
  previewContainerProps,
  isMuted,
}: IConversationListItemProps) {
  const { themed, theme } = useAppTheme()
  const { screenHorizontalPadding } = useConversationListStyles()

  const { style: previewContainerStyle, ...restPreviewContainerProps } = previewContainerProps ?? {}

  // https://github.com/dominicstop/react-native-ios-context-menu/issues/9#issuecomment-1047058781
  // Need this to prevent a crash since this component is wrapped by context menu in conversation list screen.
  // Temporary fix until we migrate to new architecture.
  const handleLongPress = useCallback(() => {}, [])

  const containerStyle = useMemo(
    () => [themed($container), { paddingHorizontal: screenHorizontalPadding }],
    [themed, screenHorizontalPadding],
  )

  const messagePreviewContainerStyle = useMemo(
    () => [themed($messagePreviewContainer), previewContainerStyle],
    [themed, previewContainerStyle],
  )

  const indicatorContainerStyle = useMemo(() => themed($indicatorContainer), [themed])

  const unreadDotStyle = useMemo(() => themed($unreadDot), [themed])

  return (
    <TouchableHighlight
      disabled={!onPress}
      onPress={onPress}
      // https://github.com/dominicstop/react-native-ios-context-menu/issues/9#issuecomment-1047058781
      // Need this to prevent a crash since this component is wrapped by context menu in conversation list screen.
      // Temporary fix until we migrate to new architecture.
      delayLongPress={200}
      onLongPress={handleLongPress}
      style={containerStyle}
    >
      <>
        <Center style={$avatarWrapper}>{avatarComponent}</Center>
        <VStack style={messagePreviewContainerStyle} {...restPreviewContainerProps}>
          {typeof title === "string" ? (
            <ConversationListItemTitle>{title}</ConversationListItemTitle>
          ) : (
            title
          )}
          {typeof subtitle === "string" ? (
            <ConversationListItemSubtitle>{subtitle}</ConversationListItemSubtitle>
          ) : (
            subtitle
          )}
        </VStack>
        {(isUnread || showError || isMuted) && (
          <AnimatedCenter
            entering={theme.animation.reanimatedFadeInScaleIn()}
            exiting={theme.animation.reanimatedFadeOutScaleOut()}
            style={indicatorContainerStyle}
          >
            {showError ? (
              <Icon icon="exclamationmark.triangle" size={theme.iconSize.sm} />
            ) : isUnread ? (
              <Center style={unreadDotStyle} />
            ) : isMuted ? (
              <Icon icon="bell-slash.fill" color={theme.colors.text.tertiary} />
            ) : null}
          </AnimatedCenter>
        )}
      </>
    </TouchableHighlight>
  )
})

export const ConversationListItemTitle = memo(function ConversationListItemTitle(
  props: ITextProps,
) {
  return <Text preset="bodyBold" weight="medium" numberOfLines={1} {...props} />
})

export const ConversationListItemSubtitle = memo(function ConversationListItemSubtitle(
  props: ITextProps,
) {
  return <Text preset="small" color="secondary" numberOfLines={2} {...props} />
})

const $avatarWrapper: ViewStyle = {
  alignSelf: "center",
}

const $messagePreviewContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  flexShrink: 1,
  marginLeft: spacing.xs,
})

const $indicatorContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  marginLeft: spacing.xs,
  minWidth: spacing.sm, // Ensure consistent width for all indicators
})

const $unreadDot: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  width: spacing.sm,
  height: spacing.sm,
  borderRadius: spacing.xs,
  backgroundColor: colors.fill.primary,
})

const $container: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingVertical: spacing.xs,
  backgroundColor: colors.background.surfaceless,
  flexDirection: "row",
})
