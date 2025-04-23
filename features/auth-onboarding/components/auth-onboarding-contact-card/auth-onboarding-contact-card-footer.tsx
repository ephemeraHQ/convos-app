import { usePrivy } from "@privy-io/expo"
import { isAxiosError } from "axios"
import React, { memo, useCallback, useState, useEffect } from "react"
import { SharedValue } from "react-native-reanimated"
import { z } from "zod"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { VStack } from "@/design-system/VStack"
import { OnboardingFooter } from "@/features/auth-onboarding/components/onboarding-footer"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { IPrivyUserId } from "@/features/authentication/authentication.types"
import { hydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useCreateUserMutation } from "@/features/current-user/create-user.mutation"
import { ConvosProfileSchema } from "@/features/profiles/profiles.types"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { waitUntilPromise } from "@/utils/wait-until-promise"
import { getFirstZodValidationError, isZodValidationError } from "@/utils/zod"

// Create a subset of the profile schema for just name validation
const createProfileSchema = z.object({
  name: ConvosProfileSchema.shape.name,
})

// Expose the continue function for keyboard events
export let handleContinue: (() => Promise<void>) | undefined

type IAuthOnboardingContactCardFooterProps = {
  footerContainerHeightAV: SharedValue<number>
}

export const AuthOnboardingContactCardFooter = memo(function AuthOnboardingContactCardFooter(
  props: IAuthOnboardingContactCardFooterProps
) {
  const { footerContainerHeightAV } = props
  const { mutateAsync: createUserAsync, isPending: isCreatingUser } = useCreateUserMutation()

  const isAvatarUploading = useAuthOnboardingStore((state) => state.isAvatarUploading)
  const isProcessingWeb3Stuff = useAuthOnboardingStore((s) => s.isProcessingWeb3Stuff)
  const setUserFriendlyError = useAuthOnboardingStore((s) => s.actions.setUserFriendlyError)

  const [pressedOnContinue, setPressedOnContinue] = useState(false)

  const { user: privyUser } = usePrivy()

  const handleRealContinue = useCallback(async () => {
    try {
      setPressedOnContinue(true)
      setUserFriendlyError(null)

      // Wait until we finished processing web3 stuff
      await waitUntilPromise({
        checkFn: () => !useAuthOnboardingStore.getState().isProcessingWeb3Stuff,
      })

      const currentSender = useMultiInboxStore.getState().currentSender
      const store = useAuthOnboardingStore.getState()

      if (!currentSender) {
        throw new Error("No current sender found, please logout")
      }

      if (!privyUser) {
        throw new Error("No Privy user found, please logout")
      }

      // Validate inputs locally before sending to API
      try {
        createProfileSchema.parse({
          name: store.name,
        })
      } catch (validationError) {
        if (isZodValidationError(validationError)) {
          const errorMessage = getFirstZodValidationError(validationError)
          setUserFriendlyError(errorMessage)
          setPressedOnContinue(false)
          return // Stop here and don't proceed with API call
        }
      }

      await createUserAsync({
        inboxId: currentSender.inboxId,
        privyUserId: privyUser.id as IPrivyUserId,
        smartContractWalletAddress: currentSender.ethereumAddress,
        profile: {
          name: store.name,
          username: store.username,
          avatar: store.avatar ?? null,
          description: null, // For now there's no field for description in the onboarding
        },
      })

      await hydrateAuth()
    } catch (error) {
      if (isZodValidationError(error)) {
        const errorMessage = getFirstZodValidationError(error)
        setUserFriendlyError(errorMessage)
      } else if (isAxiosError(error)) {
        const userMessage =
          error.response?.status === 409
            ? "This username is already taken"
            : "Failed to create profile. Please try again."
        setUserFriendlyError(userMessage)
      } else {
        const errorMessage = "An unexpected error occurred. Please try again."
        setUserFriendlyError(errorMessage)
        showSnackbar({
          message: errorMessage,
          type: "error",
        })
        
        captureErrorWithToast(
          new GenericError({
            error,
            additionalMessage: errorMessage,
          }),
        )
      }
    } finally {
      setPressedOnContinue(false)
    }
  }, [createUserAsync, privyUser, setUserFriendlyError])

  // Store the continue function in the exported variable
  useEffect(() => {
    handleContinue = handleRealContinue
    return () => {
      handleContinue = undefined
    }
  }, [handleRealContinue])

  return (
    <VStack
      onLayout={(event) => {
        footerContainerHeightAV.value = event.nativeEvent.layout.height
      }}
    >
      <OnboardingFooter
        text={"That's me"}
        variant="outline"
        onPress={handleRealContinue}
        isLoading={
          isCreatingUser ||
          isAvatarUploading ||
          // Show loading if user pressed on continue but we're still creating their web3 stuff in the background
          (pressedOnContinue && isProcessingWeb3Stuff)
        }
      />
    </VStack>
  )
})
