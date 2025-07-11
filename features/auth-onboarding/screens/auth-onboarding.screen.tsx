import { memo } from "react"
import { AuthOnboardingContactCard } from "@/features/auth-onboarding/components/auth-onboarding-contact-card/auth-contact-card"
import { AuthOnboardingWelcome } from "@/features/auth-onboarding/components/auth-onboarding-welcome"
import { AuthOnboardingContextProvider } from "@/features/auth-onboarding/contexts/auth-onboarding.context"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"

export const AuthOnboardingScreen = memo(function AuthScreen() {
  return (
    <AuthOnboardingContextProvider>
      <AuthOnboardingScreenContent />
    </AuthOnboardingContextProvider>
  )
})

const AuthOnboardingScreenContent = memo(function AuthOnboardingScreenContent() {
  const page = useAuthOnboardingStore((s) => s.page)

  if (page === "welcome") {
    return <AuthOnboardingWelcome />
  }

  return <AuthOnboardingContactCard />
})
