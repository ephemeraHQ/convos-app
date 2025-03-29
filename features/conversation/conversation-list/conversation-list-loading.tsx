import React, { memo, useRef } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AnimatedTextCarousel } from "@/components/animated-text-carousel"
import { ElapsedTimeCounter } from "@/components/elapsed-time-counter"
import { useHeaderHeight } from "@/design-system/Header/Header.utils"
import { Loader } from "@/design-system/loader"
import { Text } from "@/design-system/Text"
import { getTextStyle } from "@/design-system/Text/Text.utils"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
import { ConversationListEmpty } from "@/features/conversation/conversation-list/conversation-list-empty"
import { translate } from "@/i18n"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"

export const ConversationListLoading = memo(function ConversationListLoading() {
  const { theme, themed } = useAppTheme()

  // Capture the mount time to use as startTime for the counter
  const startTimeRef = useRef(Date.now())

  const headerHeight = useHeaderHeight()

  const insets = useSafeAreaInsets()

  return (
    <AnimatedVStack
      style={$globalStyles.flex1}
      entering={theme.animation.reanimatedFadeInSpring}
      exiting={theme.animation.reanimatedFadeOutSpring}
    >
      <ConversationListEmpty />
      <VStack
        style={[
          $globalStyles.absoluteFill,
          {
            rowGap: theme.spacing.sm,
            alignItems: "center",
            justifyContent: "center",
            // To make sure the loader is centered based on the screen height
            bottom: headerHeight + insets.top,
          },
        ]}
      >
        <Loader size="lg" />
        <VStack
          style={{
            rowGap: theme.spacing.xxxs,
            alignItems: "center",
          }}
        >
          {/* <Text preset="bodyBold">Hello</Text> */}
          <AnimatedTextCarousel
            texts={["Hello", "Bonjour", "Ciao", "Hola"]}
            textStyle={getTextStyle(themed, {
              preset: "bodyBold",
            })}
            msDelayBetweenTextChange={2000}
          />
          <Text color="secondary" preset="small">
            {translate("Gathering your messages")}
          </Text>
        </VStack>
        <ElapsedTimeCounter preset="smaller" color="tertiary" startTimeMs={startTimeRef.current} />
      </VStack>
    </AnimatedVStack>
  )
})
