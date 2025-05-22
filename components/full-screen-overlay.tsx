import { memo } from "react"
import Animated from "react-native-reanimated"
import { useAppStore } from "@/stores/app.store"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"

export const FullScreenOverlay = memo(function FullScreenOverlay() {
  const { theme } = useAppTheme()

  const isShowingFullScreenOverlay = useAppStore((s) => s.isShowingFullScreenOverlay)

  if (!isShowingFullScreenOverlay) {
    return null
  }

  return (
    <Animated.View
      entering={theme.animation.reanimatedFadeInSpring}
      style={[
        $globalStyles.absoluteFill,
        {
          zIndex: 9999,
          backgroundColor: theme.colors.background.scrim,
        },
      ]}
    />
  )
})
