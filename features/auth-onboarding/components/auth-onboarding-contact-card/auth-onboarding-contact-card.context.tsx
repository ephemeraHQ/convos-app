import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { usePrivy } from "@privy-io/expo"
import { isAxiosError } from "axios"
import { z } from "zod"
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

type IAuthOnboardingContactCardContextValue = {
  handleContinue: () => Promise<void>
  isPending: boolean
}

const AuthOnboardingContactCardContext = createContext<IAuthOnboardingContactCardContextValue | undefined>(undefined)

export const useAuthOnboardingContactCardContext = () => {
  const context = useContext(AuthOnboardingContactCardContext)
  if (!context) {
    throw new Error("useAuthOnboardingContactCardContext must be used within an AuthOnboardingContactCardProvider")
  }
  return context
}

export const AuthOnboardingContactCardProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { mutateAsync: createUserAsync, isPending: isCreatingUser } = useCreateUserMutation()
  const [pressedOnContinue, setPressedOnContinue] = useState(false)
  const { user: privyUser } = usePrivy()

  const isAvatarUploading = useAuthOnboardingStore((state) => state.isAvatarUploading)
  const isProcessingWeb3Stuff = useAuthOnboardingStore((s) => s.isProcessingWeb3Stuff)
  const setUserFriendlyError = useAuthOnboardingStore((s) => s.actions.setUserFriendlyError)

  const handleContinue = useCallback(async () => {
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
          return
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
          description: null,
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
        captureErrorWithToast(
          new GenericError({
            error,
            additionalMessage: "An unexpected error occurred. Please try again.",
          }),
          {
            message: "An unexpected error occurred. Please try again.",
          }
        )
      }
    } finally {
      setPressedOnContinue(false)
    }
  }, [createUserAsync, privyUser, setUserFriendlyError])

  const isPending = isCreatingUser || isAvatarUploading || (pressedOnContinue && isProcessingWeb3Stuff)

  const contextValue = useMemo(
    () => ({
      handleContinue,
      isPending,
    }),
    [handleContinue, isPending]
  )

  return (
    <AuthOnboardingContactCardContext.Provider value={contextValue}>
      {children}
    </AuthOnboardingContactCardContext.Provider>
  )
} 