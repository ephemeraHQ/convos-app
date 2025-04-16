import { ViewStyle, ImageStyle, Dimensions } from 'react-native'
import { ThemedStyle } from '@/theme/use-app-theme'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export const $container: ViewStyle = {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
}

export const $imageContainer: ViewStyle = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  justifyContent: 'center',
  alignItems: 'center',
}

export const $image: ImageStyle = {
  width: '100%',
  height: '100%',
}

export const $animatedImageContainer: ViewStyle = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
}

export const $closeButton: ThemedStyle<ViewStyle> = ({ colors, spacing, iconSize, borderRadius }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  margin: spacing.sm,
  width: iconSize.lg,
  height: iconSize.lg,
  borderRadius: borderRadius.md,
  backgroundColor: colors.background.surfaceless,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
})

export const $infoContainer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: 'absolute',
  top: 64,
  left: 0,
  right: 0,
  padding: spacing.md,
  backgroundColor: colors.background.surfaceless,
  alignItems: 'flex-start',
})
