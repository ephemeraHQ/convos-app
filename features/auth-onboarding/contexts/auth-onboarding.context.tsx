import {
  PrivyUser,
  usePrivy,
  useEmbeddedEthereumWallet as usePrivyEmbeddedEthereumWallet,
} from "@privy-io/expo"
import {
  useLoginWithPasskey as usePrivyLoginWithPasskey,
  useSignupWithPasskey as usePrivySignupWithPasskey,
} from "@privy-io/expo/passkey"
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react"
import { RELYING_PARTY } from "@/features/auth-onboarding/auth-onboarding.constants"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { hydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { useSmartWalletClient } from "@/features/wallets/smart-wallet"
import { createXmtpSignerFromSwc } from "@/features/wallets/utils/create-xmtp-signer-from-swc"
import { createXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { useWaitUntil } from "@/hooks/use-wait-until"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { authLogger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"

type IAuthOnboardingContextType = {
  user: PrivyUser | null
  login: () => Promise<void>
  signup: () => Promise<void>
}

type IAuthOnboardingContextProps = {
  children: React.ReactNode
}

const AuthOnboardingContext = createContext<IAuthOnboardingContextType>(
  {} as IAuthOnboardingContextType,
)

export const AuthOnboardingContextProvider = (props: IAuthOnboardingContextProps) => {
  const { children } = props

  const { smartWalletClient } = useSmartWalletClient()
  const { create: createEmbeddedWallet } = usePrivyEmbeddedEthereumWallet()
  const { loginWithPasskey: privyLoginWithPasskey } = usePrivyLoginWithPasskey()
  const { signupWithPasskey: privySignupWithPasskey } = usePrivySignupWithPasskey()
  const { user: privyUser, isReady: isPrivyReady } = usePrivy()

  const { logout } = useLogout()

  useEffect(() => {
    return () => {
      // Reset the store when the component unmounts
      useAuthOnboardingStore.getState().actions.reset()
    }
  }, [])

  const { waitUntil: waitUntilPrivyIsReady } = useWaitUntil({
    thing: isPrivyReady,
  })

  const { waitUntil: waitUntilSmartWalletClientIsReady } = useWaitUntil({
    thing: smartWalletClient,
    timeoutMs: 20000, // Yes unfortunately, this can sometimes take a while... Need to investigate our RPC
  })

  const login = useCallback(async () => {
    try {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(true)

      // Step 1: Passkey login
      authLogger.debug(`[Passkey Login] Starting passkey authentication`)

      await waitUntilPrivyIsReady()

      const { data: privyUser, error: passkeyLoginError } = await tryCatch(
        privyLoginWithPasskey({
          relyingParty: RELYING_PARTY,
        }),
      )

      if (passkeyLoginError) {
        throw passkeyLoginError
      }

      if (!privyUser) {
        throw new Error("Passkey login failed")
      }

      // Step 2: Wallet
      authLogger.debug(`Waiting for smart wallet to be created`)
      const { data: swcClient, error: swcError } = await tryCatch(
        waitUntilSmartWalletClientIsReady(),
      )

      if (swcError) {
        throw swcError
      }

      if (!swcClient) {
        throw new Error("Smart wallet creation failed")
      }

      authLogger.debug(`Smart wallet created`)

      // Step 3: XMTP Inbox client
      const xmtpClient = await createXmtpClient({
        inboxSigner: createXmtpSignerFromSwc(swcClient),
      })

      if (!xmtpClient) {
        throw new Error("XMTP client creation failed")
      }

      const isValid = await validateXmtpInstallation({
        inboxId: xmtpClient.inboxId,
      })

      if (!isValid) {
        throw new Error("Invalid client installation")
      }

      // Step 4: Set the current sender
      useMultiInboxStore.getState().actions.setCurrentSender({
        ethereumAddress: swcClient.account.address as IEthereumAddress,
        inboxId: xmtpClient.inboxId as IXmtpInboxId,
      })

      await hydrateAuth()
    } catch (error) {
      logout({ caller: "AuthContextProvider.login" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
      if (
        error instanceof Error &&
        (error.message.includes("UserCancelled") ||
          // Happens when we also cancel the passkey login
          error.message.includes(
            "(com.apple.AuthenticationServices.AuthorizationError error 1001.)",
          ))
      ) {
        // User cancelled the passkey login
      } else {
        captureErrorWithToast(
          new AuthenticationError({ error, additionalMessage: "Failed to login with passkey" }),
        )
      }
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [privyLoginWithPasskey, logout, waitUntilPrivyIsReady, waitUntilSmartWalletClientIsReady])

  const signup = useCallback(async () => {
    try {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(true)

      // Step 1: Passkey signup
      authLogger.debug(`[Passkey Signup] Starting passkey registration`)

      await waitUntilPrivyIsReady()

      const { data: user, error: signupError } = await tryCatch(
        privySignupWithPasskey({ relyingParty: RELYING_PARTY }),
      )

      if (signupError) {
        throw signupError
      }

      if (!user) {
        throw new Error("Passkey signup failed")
      }

      useAuthOnboardingStore.getState().actions.setPage("contact-card")

      // Step 2: Create embedded wallet
      authLogger.debug(`Creating embedded wallet`)
      const { error: walletError } = await tryCatch(createEmbeddedWallet())

      if (walletError) {
        throw walletError
      }

      authLogger.debug(`Waiting for smart wallet to be created`)
      const { data: swcClient, error: swcError } = await tryCatch(
        waitUntilSmartWalletClientIsReady(),
      )

      if (swcError) {
        throw swcError
      }

      if (!swcClient) {
        throw new Error("Smart wallet creation failed")
      }

      authLogger.debug(`Smart wallet created`)

      // Step 3: Create XMTP Inbox
      const { data: xmtpClient, error: xmtpError } = await tryCatch(
        createXmtpClient({
          inboxSigner: createXmtpSignerFromSwc(swcClient),
        }),
      )

      if (xmtpError) {
        throw xmtpError
      }

      if (!xmtpClient) {
        throw new Error("XMTP client creation failed")
      }

      // Step 4: Set the current sender
      useMultiInboxStore.getState().actions.setCurrentSender({
        ethereumAddress: swcClient.account.address as IEthereumAddress,
        inboxId: xmtpClient.inboxId as IXmtpInboxId,
      })
    } catch (error) {
      logout({ caller: "AuthContextProvider.signup" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
      if (
        error instanceof Error &&
        (error.message.includes("UserCancelled") ||
          // Happens when we also cancel the passkey registration
          error.message.includes(
            "(com.apple.AuthenticationServices.AuthorizationError error 1001.)",
          ))
      ) {
        // User cancelled the passkey registration
      } else {
        captureErrorWithToast(
          new AuthenticationError({ error, additionalMessage: "Failed to sign up with passkey" }),
        )
      }
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [
    createEmbeddedWallet,
    privySignupWithPasskey,
    logout,
    waitUntilPrivyIsReady,
    waitUntilSmartWalletClientIsReady,
  ])

  const value = useMemo(() => ({ login, signup, user: privyUser }), [login, signup, privyUser])

  return <AuthOnboardingContext.Provider value={value}>{children}</AuthOnboardingContext.Provider>
}

export function useAuthOnboardingContext(): IAuthOnboardingContextType {
  const context = useContext(AuthOnboardingContext)
  if (!context) {
    throw new Error("useAuthOnboardingContext must be used within an AuthOnboardingContextProvider")
  }
  return context
}
