import React, { memo, useCallback } from "react"
import { TextStyle, ViewStyle } from "react-native"
import { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { Screen } from "@/components/screen/screen"
import { Text } from "@/design-system/Text"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
import { OnboardingSubtitle } from "@/features/auth-onboarding/components/onboarding-subtitle"
import { OnboardingTitle } from "@/features/auth-onboarding/components/onboarding-title"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { ProfileContactCardLayout } from "@/features/profiles/components/profile-contact-card/profile-contact-card-layout"
import { useProfileContactCardStyles } from "@/features/profiles/components/profile-contact-card/use-profile-contact-card.styles"
import { useAnimatedKeyboard } from "@/hooks/use-animated-keyboard"
import { useHeader } from "@/navigation/use-header"
import { $globalStyles } from "@/theme/styles"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { AuthOnboardingContactCardAvatar } from "./auth-onboarding-contact-card-avatar"
import { AuthOnboardingContactCardFooter, handleContinue } from "./auth-onboarding-contact-card-footer"
import { AuthOnboardingContactCardImport } from "./auth-onboarding-contact-card-import"
import { AuthOnboardingContactCardNameInput } from "./auth-onboarding-contact-card-name-input"

export const AuthOnboardingContactCard = memo(function AuthOnboardingContactCard() {
  const { themed, theme } = useAppTheme()
  const userFriendlyError = useAuthOnboardingStore((s) => s.userFriendlyError)
  
  const { container: containerStyles } = useProfileContactCardStyles()

  // Clear errors on mounts
  React.useEffect(() => {
    useAuthOnboardingStore.getState().actions.setUserFriendlyError(null)
  }, [])

  useHeader({
    safeAreaEdges: ["top"],
    leftText: "Cancel",
    onLeftPress: () => useAuthOnboardingStore.getState().actions.setPage("welcome"),
  })

  const { progressAV: keyboardProgressAV } = useAnimatedKeyboard()

  const textContainerHeightAV = useSharedValue(0)
  const contentContainerHeightAV = useSharedValue(0)
  const cardContainerHeightAV = useSharedValue(0)
  const footerContainerHeightAV = useSharedValue(0)
  
  // Handle keyboard submit action
  const handleSubmit = useCallback(() => {
    if (handleContinue) {
      handleContinue()
    }
  }, [])

  // To make sure the card is vertically centered when the keyboard is open
  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            keyboardProgressAV.value,
            [0, 1],
            [
              0,
              -contentContainerHeightAV.value / 2 +
                cardContainerHeightAV.value / 2 +
                footerContainerHeightAV.value -
                textContainerHeightAV.value / 2 -
                theme.spacing.sm, // Move it slightly higher in the screen above the keyboard
            ],
            "clamp",
          ),
        },
      ],
    }
  })

  const textContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(keyboardProgressAV.value, [0, 1], [1, 0], "clamp"),
    }
  })

  return (
    <AnimatedVStack entering={theme.animation.reanimatedFadeInSpringSlow()} style={$root}>
      <Screen contentContainerStyle={$globalStyles.flex1} safeAreaEdges={["bottom"]}>
        <AnimatedVStack
          style={[
            themed($contentContainer),
            contentAnimatedStyle,
            $contentSpacing(theme.spacing.lg - containerStyles.margin),
          ]}
          onLayout={(event) => {
            contentContainerHeightAV.value = event.nativeEvent.layout.height
          }}
        >
          <AnimatedVStack
            style={[textContainerAnimatedStyle, themed($textContainer)]}
            onLayout={(event) => {
              textContainerHeightAV.value = event.nativeEvent.layout.height
            }}
          >
            <OnboardingTitle size={"xl"}>Complete your{`\n`}contact card</OnboardingTitle>
            <OnboardingSubtitle>Choose how you show up</OnboardingSubtitle>
          </AnimatedVStack>

          <VStack
            onLayout={(event) => {
              cardContainerHeightAV.value = event.nativeEvent.layout.height
            }}
          >
            <ProfileContactCardLayout
              name={<AuthOnboardingContactCardNameInput onSubmitEditing={handleSubmit} />}
              avatar={<AuthOnboardingContactCardAvatar />}
              additionalOptions={<AuthOnboardingContactCardImport />}
            />
          </VStack>

          <Text 
            preset="small" 
            color={userFriendlyError ? "caution" : "secondary"} 
            style={themed($footerText)}
          >
            {userFriendlyError || "You can update this anytime."}
          </Text>

          <AuthOnboardingContactCardFooter 
            footerContainerHeightAV={footerContainerHeightAV}
          />
        </AnimatedVStack>
      </Screen>
    </AnimatedVStack>
  )
})

const $root: ViewStyle = {
  flex: 1,
}

const $contentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.lg,
  justifyContent: "center",
})

const $contentSpacing = (spacing: number): ViewStyle => ({
  paddingHorizontal: spacing,
  rowGap: spacing,
})

const $textContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  rowGap: spacing.sm,
})

const $footerText: ThemedStyle<TextStyle> = ({ spacing }) => ({
  textAlign: "center",
  paddingHorizontal: spacing.lg,
})
