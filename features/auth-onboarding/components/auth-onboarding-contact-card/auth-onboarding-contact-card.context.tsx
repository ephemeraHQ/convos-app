import { useTurnkey } from "@turnkey/sdk-react-native"
import { isAxiosError } from "axios"
import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { z } from "zod"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { ITurnkeyUserId } from "@/features/authentication/authentication.types"
import { useHydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useCreateUserMutation } from "@/features/current-user/create-user.mutation"
import { ConvosProfileSchema } from "@/features/profiles/profiles.types"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { waitUntilPromise } from "@/utils/wait-until-promise"
import { getFirstZodValidationError, isZodValidationError } from "@/utils/zod"

const createProfileSchema = z.object({
  name: ConvosProfileSchema.shape.name,
})

type IAuthOnboardingContactCardContextValue = {
  handleContinue: () => Promise<void>
  isPending: boolean
}

const AuthOnboardingContactCardContext = createContext<
  IAuthOnboardingContactCardContextValue | undefined
>(undefined)

export const useAuthOnboardingContactCardContext = () => {
  const context = useContext(AuthOnboardingContactCardContext)
  if (!context) {
    throw new Error(
      "useAuthOnboardingContactCardContext must be used within an AuthOnboardingContactCardProvider",
    )
  }
  return context
}

export const AuthOnboardingContactCardProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { mutateAsync: createUserAsync, isPending: isCreatingUser } = useCreateUserMutation()
  const [pressedOnContinue, setPressedOnContinue] = useState(false)

  const isAvatarUploading = useAuthOnboardingStore((state) => state.isAvatarUploading)
  const setUserFriendlyError = useAuthOnboardingStore((s) => s.actions.setUserFriendlyError)
  const isSigningIn = useAuthOnboardingStore((s) => s.isSigningIn)
  const isSigningUp = useAuthOnboardingStore((s) => s.isSigningUp)

  const { user } = useTurnkey()
  const { hydrateAuth } = useHydrateAuth()

  const handleContinue = useCallback(async () => {
    try {
      setPressedOnContinue(true)
      setUserFriendlyError(null)

      // Wait until we finished processing web3 stuff
      await waitUntilPromise({
        checkFn: () => {
          const isSigningIn = useAuthOnboardingStore.getState().isSigningIn
          const isSigningUp = useAuthOnboardingStore.getState().isSigningUp
          return !isSigningIn && !isSigningUp
        },
      })

      const currentSender = useMultiInboxStore.getState().currentSender
      const store = useAuthOnboardingStore.getState()

      if (!currentSender) {
        throw new Error("No current sender found, please logout")
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

      const xmtpClient = await getXmtpClientByInboxId({
        inboxId: currentSender.inboxId,
      })

      await createUserAsync({
        inboxId: currentSender.inboxId,
        turnkeyUserId: user?.id as ITurnkeyUserId,
        smartContractWalletAddress: currentSender.ethereumAddress,
        xmtpInstallationId: xmtpClient.installationId,
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
          },
        )
      }
    } finally {
      setPressedOnContinue(false)
    }
  }, [createUserAsync, setUserFriendlyError, user?.id, hydrateAuth])

  const isPending =
    isCreatingUser || isAvatarUploading || pressedOnContinue || isSigningIn || isSigningUp

  const contextValue = useMemo(
    () => ({
      handleContinue,
      isPending,
    }),
    [handleContinue, isPending],
  )

  return (
    <AuthOnboardingContactCardContext.Provider value={contextValue}>
      {children}
    </AuthOnboardingContactCardContext.Provider>
  )
}
