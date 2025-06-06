import { memo, useMemo } from "react"
import { ImageStyle, TextStyle, ViewStyle } from "react-native"
import { Screen } from "@/components/screen/screen"
import { AnimatedCenter, Center } from "@/design-system/Center"
import { IHeaderProps } from "@/design-system/Header/Header"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { HStack } from "@/design-system/HStack"
import { Image } from "@/design-system/image"
import { Link } from "@/design-system/link"
import { Pressable } from "@/design-system/Pressable"
import { AnimatedText, Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { ONBOARDING_ENTERING_DELAY } from "@/features/auth-onboarding/auth-onboarding.constants"
import { useAuthOnboardingContext } from "@/features/auth-onboarding/contexts/auth-onboarding.context"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { useHeader } from "@/navigation/use-header"
import { $globalStyles } from "@/theme/styles"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { openLink } from "@/utils/linking"
import { AuthOnboardingWelcomeFooter } from "./auth-onboarding-welcome-footer"

export const AuthOnboardingWelcome = memo(function AuthOnboardingWelcome() {
  const { themed, theme } = useAppTheme()

  // const { logout } = useLogout()

  // Makes sense to make sure we're fully logged out when we are at this welcome screen
  // useEffect(() => {
  //   logout({ caller: "AuthWelcomeContent onMount" }).catch(captureError)
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [])

  useHeaderWrapper()

  return (
    <Screen contentContainerStyle={$globalStyles.flex1} safeAreaEdges={["bottom"]} preset="fixed">
      <Center style={$globalStyles.flex1}>
        <VStack>
          {/* This is a really custom text. No preset */}
          <AnimatedText
            preset="uncensoredTitle"
            entering={theme.animation
              .reanimatedFadeInSpringSlow()
              .delay(ONBOARDING_ENTERING_DELAY.FIRST)}
            style={themed($titleStyle)}
          >
            Uncensored{"\n"}
            messaging
          </AnimatedText>
          <AnimatedText
            preset="small"
            entering={theme.animation
              .reanimatedFadeInSpringSlow()
              .delay(ONBOARDING_ENTERING_DELAY.SECOND)}
            style={themed($subtextStyle)}
            color={"secondary"}
          >
            Secure. Decentralized.{"\n"}
            No phone number required.
          </AnimatedText>
        </VStack>
      </Center>

      <AuthOnboardingWelcomeFooter />
      <TermsAndConditions />
    </Screen>
  )
})

const TermsAndConditions = memo(function TermsAndConditions() {
  const { theme, themed } = useAppTheme()

  const isSigningUp = useAuthOnboardingStore((s) => s.isSigningUp)
  const isSigningIn = useAuthOnboardingStore((s) => s.isSigningIn)

  const isDisabled = isSigningUp || isSigningIn

  return (
    <AnimatedCenter
      entering={theme.animation.reanimatedFadeInSpringSlow().delay(ONBOARDING_ENTERING_DELAY.FIFTH)}
      style={themed($termsContainer)}
    >
      <Pressable>
        <Text
          preset="smaller"
          color="secondary"
          disabled={isDisabled}
          style={{
            textAlign: "center",
            lineHeight: theme.spacing.md,
          }}
        >
          When you continue, you agree to the{"\n"}Convos{" "}
          <Link
            preset="smaller"
            color="secondary"
            disabled={isDisabled}
            onPress={() => openLink({ url: "https://convos.org/terms-of-service" })}
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            preset="smaller"
            color="secondary"
            disabled={isDisabled}
            onPress={() => openLink({ url: "https://convos.org/privacy-policy" })}
          >
            Privacy Policy
          </Link>
        </Text>
      </Pressable>
    </AnimatedCenter>
  )
})

function useHeaderWrapper() {
  const { theme, themed } = useAppTheme()

  const { login } = useAuthOnboardingContext()

  const isSigningIn = useAuthOnboardingStore((s) => s.isSigningIn)
  const isSigningUp = useAuthOnboardingStore((s) => s.isSigningUp)

  const headerOptions = useMemo(() => {
    return {
      safeAreaEdges: ["top"],
      RightActionComponent: (
        <AnimatedCenter
          entering={theme.animation
            .reanimatedFadeInSpringSlow()
            .delay(ONBOARDING_ENTERING_DELAY.SIXTH)}
        >
          <HeaderAction
            text="Sign in"
            isLoading={isSigningIn}
            disabled={isSigningIn || isSigningUp}
            onPress={login}
          />
        </AnimatedCenter>
      ),
      LeftActionComponent: (
        <AnimatedCenter
          entering={theme.animation
            .reanimatedFadeInSpringSlow()
            .delay(ONBOARDING_ENTERING_DELAY.SIXTH)}
        >
          <HStack style={{ alignItems: "center", paddingLeft: theme.spacing.sm }}>
            <Image
              source={require("@/assets/icons/convos-orange.svg")}
              style={themed($logoImage)}
              contentFit="contain"
            />
            <Text preset="body">Convos</Text>
            <Text
              preset="smaller"
              color="secondary"
              // This is to make the text look centered vertically
              style={{ paddingLeft: theme.spacing.xxs, paddingTop: 3 }}
            >
              EARLY
            </Text>
          </HStack>
        </AnimatedCenter>
      ),
    } satisfies IHeaderProps
  }, [isSigningIn, isSigningUp, login, themed, theme])

  return useHeader(headerOptions, [headerOptions])
}

const $termsContainer: ThemedStyle<ViewStyle> = ({ spacing, borderRadius, colors }) => ({
  padding: spacing.sm,
  marginHorizontal: spacing.lg,
  borderRadius: borderRadius.xxs,
})

const $subtextStyle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  textAlign: "center",
  lineHeight: spacing.md,
})

const $titleStyle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  textAlign: "center",
  marginTop: spacing.xs,
  marginBottom: spacing.xxs,
})

const $logoImage: ThemedStyle<ImageStyle> = () => ({
  width: 24,
  height: 24,
  marginRight: 8,
})
