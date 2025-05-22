import { memo } from "react"
import { AnimatedVStack } from "@/design-system/VStack"
import { ONBOARDING_ENTERING_DELAY } from "@/features/auth-onboarding/auth-onboarding.constants"
import { OnboardingFooter } from "@/features/auth-onboarding/components/onboarding-footer"
import { useAuthOnboardingContext } from "@/features/auth-onboarding/contexts/auth-onboarding.context"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { useAppTheme } from "@/theme/use-app-theme"

export const AuthOnboardingWelcomeFooter = memo(function AuthOnboardingWelcomeFooter() {
  const { theme } = useAppTheme()
  const { signup } = useAuthOnboardingContext()

  const isSigningUp = useAuthOnboardingStore((s) => s.isSigningUp)
  const isSigningIn = useAuthOnboardingStore((s) => s.isSigningIn)

  return (
    <AnimatedVStack
      entering={theme.animation
        .reanimatedFadeInSpringSlow()
        .delay(ONBOARDING_ENTERING_DELAY.FOURTH)}
    >
      <OnboardingFooter
        text="Create your Contact Card"
        onPress={signup}
        isLoading={isSigningUp}
        disabled={isSigningUp || isSigningIn}
      />
    </AnimatedVStack>
  )
})
