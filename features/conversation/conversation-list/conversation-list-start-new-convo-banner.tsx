import React, { memo, useEffect } from "react"
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import {
  BannerContainer,
  BannerContentContainer,
  BannerIcon,
  BannerSubtitle,
  BannerTitle,
} from "@/components/banner"
import { AnimatedCenter } from "@/design-system/Center"
import { useAppTheme } from "@/theme/use-app-theme"

export const ConversationListStartNewConvoBanner = memo(
  function ConversationListStartNewConvoBanner() {
    const { theme } = useAppTheme()

    const bounceTranslateYAV = useSharedValue(0)

    const as = useAnimatedStyle(() => {
      return {
        transform: [{ translateY: bounceTranslateYAV.value }],
      }
    }, [])

    useEffect(() => {
      const timingConfig = {
        duration: theme.timing.slow,
      }
      bounceTranslateYAV.value = withSequence(
        withTiming(0, timingConfig),
        withRepeat(withTiming(-theme.spacing.xs, timingConfig), -1, true),
      )
    }, [bounceTranslateYAV, theme])

    return (
      <BannerContainer>
        <BannerContentContainer>
          <BannerTitle>Start a conversation</BannerTitle>
          <BannerSubtitle>Invite a friend, or send a message</BannerSubtitle>
        </BannerContentContainer>
        <AnimatedCenter style={as}>
          <BannerIcon icon="chevron.up" />
        </AnimatedCenter>
      </BannerContainer>
    )
  },
)
