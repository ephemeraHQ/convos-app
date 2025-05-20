import { memo } from "react"
import { AnimatedTextCarousel } from "@/components/animated-text-carousel"
import { BlurView } from "@/design-system/BlurView"
import { Center } from "@/design-system/Center"
import { Loader } from "@/design-system/loader"
import { getTextStyle } from "@/design-system/Text/Text.utils"
import { useAppStore } from "@/stores/app.store"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"

export const FullScreenLoader = memo(function FullScreenLoader() {
  const { theme, themed } = useAppTheme()

  const fullScreenLoaderOptions = useAppStore((state) => state.fullScreenLoaderOptions)

  if (!fullScreenLoaderOptions.isVisible) {
    return null
  }

  return (
    <BlurView isAbsolute entering={theme.animation.reanimatedFadeInSpring}>
      <Center vertical style={[$globalStyles.flex1, { gap: theme.spacing.sm }]}>
        <Loader size="lg" />
        {fullScreenLoaderOptions.texts && (
          <AnimatedTextCarousel
            texts={fullScreenLoaderOptions.texts}
            textStyle={getTextStyle(themed, {
              preset: "bodyBold",
            })}
            msDelayBetweenTextChange={1400}
          />
        )}
      </Center>
    </BlurView>
  )
})
