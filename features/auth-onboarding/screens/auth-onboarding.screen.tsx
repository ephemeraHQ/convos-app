import { memo, useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { AuthOnboardingContactCard } from "@/features/auth-onboarding/components/auth-onboarding-contact-card/auth-contact-card"
import { AuthOnboardingWelcome } from "@/features/auth-onboarding/components/auth-onboarding-welcome"
import { AuthOnboardingContextProvider } from "@/features/auth-onboarding/contexts/auth-onboarding.context"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"

export const AuthOnboardingScreen = memo(function AuthScreen() {
  const [isReady, setIsReady] = useState(false)

  // Simple initialization check - Turnkey might not need this, but keeping similar structure
  useEffect(() => {
    // Set ready immediately since we don't need to wait for Turnkey initialization
    setIsReady(true)
  }, [])

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3366FF" />
      </View>
    )
  }

  return (
    <AuthOnboardingContextProvider>
      <Content />
    </AuthOnboardingContextProvider>
  )
})

const Content = memo(function Content() {
  const page = useAuthOnboardingStore((s) => s.page)

  if (page === "welcome") {
    return <AuthOnboardingWelcome />
  }

  return <AuthOnboardingContactCard />
})
