import React, { memo } from "react"
import { SharedValue } from "react-native-reanimated"
import { VStack } from "@/design-system/VStack"
import { OnboardingFooter } from "@/features/auth-onboarding/components/onboarding-footer"
import { useAuthOnboardingContactCardContext } from "./auth-onboarding-contact-card.context"

type IAuthOnboardingContactCardFooterProps = {
  footerContainerHeightAV: SharedValue<number>
}

export const AuthOnboardingContactCardFooter = memo(function AuthOnboardingContactCardFooter(
  props: IAuthOnboardingContactCardFooterProps
) {
  const { footerContainerHeightAV } = props
  const { handleContinue, isPending } = useAuthOnboardingContactCardContext()

  return (
    <VStack
      onLayout={(event) => {
        footerContainerHeightAV.value = event.nativeEvent.layout.height
      }}
    >
      <OnboardingFooter
        text={"That's me"}
        variant="outline"
        onPress={handleContinue}
        isLoading={isPending}
      />
    </VStack>
  )
})
