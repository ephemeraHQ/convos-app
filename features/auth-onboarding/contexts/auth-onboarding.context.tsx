import { TurnkeySigner } from "@turnkey/ethers"
import { createPasskey, isSupported, PasskeyStamper } from "@turnkey/react-native-passkey-stamper"
import { TurnkeyClient, useTurnkey } from "@turnkey/sdk-react-native"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import { ethers } from "ethers"
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { config } from "@/config"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { createSubOrganization } from "@/features/authentication/authentication.api"
import { hydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { createXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { authLogger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"

type IAuthOnboardingContextType = {
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
  const { logout } = useLogout()
  const { createEmbeddedKey, createSession, clearSession } = useTurnkey()

  useEffect(() => {
    // Use to clear session and do tests
    clearSession()

    return () => {
      useAuthOnboardingStore.getState().actions.reset()
    }
  }, [clearSession])

  const login = useCallback(async () => {
    if (!isSupported()) {
      showSnackbar({
        message: "Passkeys are not supported on this device",
        type: "error",
      })
      return
    }

    try {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(true)
      authLogger.debug(`Starting passkey authentication with Turnkey...`)

      const stamper = new PasskeyStamper({
        rpId: config.app.webDomain,
      })

      const httpClient = new TurnkeyClient({ baseUrl: config.turnkey.turnkeyApiUrl }, stamper)

      const targetPublicKey = await createEmbeddedKey()

      const sessionResponse = await httpClient.createReadWriteSession({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: config.turnkey.organizationId,
        parameters: {
          targetPublicKey,
        },
      })

      const credentialBundle =
        sessionResponse.activity.result.createReadWriteSessionResultV2?.credentialBundle

      if (!credentialBundle) {
        throw new Error("Failed to get credential bundle")
      }

      await createSession({
        bundle: credentialBundle,
      })

      await hydrateAuth()
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unknown error occurred")) {
        authLogger.debug("User cancelled the passkey login")
      } else {
        captureErrorWithToast(
          new AuthenticationError({ error, additionalMessage: "Failed to login with passkey" }),
          {
            message: "Failed to login with passkey",
          },
        )
      }

      logout({ caller: "AuthContextProvider.login" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [createEmbeddedKey, createSession, logout])

  const signup = useCallback(async () => {
    if (!isSupported()) {
      showSnackbar({
        message: "Passkeys are not supported on this device",
        type: "error",
      })
      return
    }

    try {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(true)
      authLogger.debug(`Starting passkey signup with Turnkey`)

      const todayBeautifulString = new Date().toISOString()

      // Step 1: Create a passkey
      const authenticatorParams = await createPasskey({
        authenticatorName: "Passkey",
        rp: {
          id: config.app.webDomain,
          name: `https://${config.app.webDomain}`,
        },
        user: {
          id: uuidv4(),
          // Name and displayName must match
          // This name is visible to the user. This is what's shown in the passkey prompt
          name: `Convos ${todayBeautifulString}`,
          displayName: `Convos ${todayBeautifulString}`,
        },
      })

      // Step 2: Create a sub organization
      const subOrgData = await createSubOrganization({
        passkey: {
          challenge: authenticatorParams.challenge,
          attestation: authenticatorParams.attestation,
        },
      })

      // Step 3: Create a session
      const stamper = new PasskeyStamper({
        rpId: config.app.webDomain,
      })

      const turnkeyClient = new TurnkeyClient({ baseUrl: "https://api.turnkey.com" }, stamper)

      const targetPublicKey = await createEmbeddedKey()

      console.log("targetPublicKey:", targetPublicKey)

      const organizationId = config.turnkey.organizationId

      console.log("subOrgData.walletAddress:", subOrgData.walletAddress)

      const sessionResponse = await turnkeyClient.createReadWriteSession({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId,
        parameters: {
          targetPublicKey,
        },
      })

      console.log("sessionResponse:", sessionResponse)

      const credentialBundle =
        sessionResponse.activity.result.createReadWriteSessionResultV2?.credentialBundle

      console.log("credentialBundle:", credentialBundle)

      if (!credentialBundle) {
        throw new Error("Failed to get credential bundle")
      }

      authLogger.debug(`Session established with organization ID: ${organizationId}`)

      await createSession({
        bundle: credentialBundle,
      })

      // Step 4: Create xmtp client
      const provider = new ethers.JsonRpcProvider(config.evm.rpcEndpoint)

      const turnkeySigner = new TurnkeySigner({
        client: turnkeyClient,
        organizationId: config.turnkey.organizationId,
        signWith: subOrgData.walletAddress,
      })
      const connectedSigner = turnkeySigner.connect(provider)

      const { data: xmtpClient, error: xmtpError } = await tryCatch(
        createXmtpClient({
          inboxSigner: {
            getIdentifier: async () => new PublicIdentity(subOrgData.walletAddress, "ETHEREUM"),
            getChainId: () => undefined,
            getBlockNumber: () => undefined,
            signerType: () => "EOA",
            signMessage: async (message: string) => {
              const signature = await connectedSigner.signMessage(message)
              return {
                signature,
              }
            },
          },
        }),
      )

      if (xmtpError) {
        throw xmtpError
      }

      if (!xmtpClient) {
        throw new Error("XMTP client creation failed")
      }

      // Step 5: Set the current sender
      useMultiInboxStore.getState().actions.setCurrentSender({
        ethereumAddress: subOrgData?.walletAddress as IEthereumAddress,
        inboxId: xmtpClient.inboxId as IXmtpInboxId,
      })

      // Step 6: Navigate to the contact card
      useAuthOnboardingStore.getState().actions.setPage("contact-card")
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unknown error occurred")) {
        authLogger.debug("User cancelled the passkey registration")
      } else {
        captureErrorWithToast(
          new AuthenticationError({ error, additionalMessage: "Failed to sign up with passkey" }),
          {
            message: "Failed to sign up with passkey",
          },
        )
      }

      logout({ caller: "AuthContextProvider.signup" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [createEmbeddedKey, createSession, logout])

  const value = useMemo(() => ({ login, signup }), [login, signup])

  return <AuthOnboardingContext.Provider value={value}>{children}</AuthOnboardingContext.Provider>
}

export function useAuthOnboardingContext(): IAuthOnboardingContextType {
  const context = useContext(AuthOnboardingContext)
  if (!context) {
    throw new Error("useAuthOnboardingContext must be used within an AuthOnboardingContextProvider")
  }
  return context
}
