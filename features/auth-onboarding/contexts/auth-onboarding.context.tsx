import { createPasskey, isSupported, PasskeyStamper } from "@turnkey/react-native-passkey-stamper"
import { TurnkeyClient, useTurnkey } from "@turnkey/sdk-react-native"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { config } from "@/config"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { createSubOrganization } from "@/features/authentication/authentication.api"
import { hydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { createXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client-create"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { useWaitUntil } from "@/hooks/use-wait-until"
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
  const {
    createEmbeddedKey,
    createSession,
    clearSession,
    createSessionFromEmbeddedKey,
    client,
    signRawPayload,
  } = useTurnkey()
  const { logout } = useLogout()

  const { waitUntil: waitUntilClient } = useWaitUntil({
    thing: client,
    timeoutMs: 10000,
    errorMessage: "Failed to create client",
  })

  useEffect(() => {
    // Use to clear session and do tests
    // clearSession()

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

      // Create a passkey stamper (this will trigger Face ID)
      authLogger.debug("Creating passkey stamper...")
      const stamper = new PasskeyStamper({
        rpId: config.app.webDomain,
      })
      authLogger.debug("Created passkey stamper")

      // Create a client with the stamper
      authLogger.debug("Creating HTTP client...")
      const httpClient = new TurnkeyClient({ baseUrl: "https://api.turnkey.com" }, stamper)
      authLogger.debug("Created HTTP client")

      // Create embedded key for the session
      authLogger.debug("Creating embedded key...")
      const targetPublicKey = await createEmbeddedKey()
      authLogger.debug("Created embedded key:", targetPublicKey)

      // Authenticate with the parent organization
      authLogger.debug("Creating read/write session...")
      const sessionResponse = await httpClient.createReadWriteSession({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: config.turnkey.organizationId, // Parent org ID
        parameters: {
          targetPublicKey,
          expirationSeconds: "86400", // 24 hours
        },
      })
      authLogger.debug("Created read/write session")

      // Extract the credential bundle
      authLogger.debug("Extracting credential bundle...")
      const credentialBundle =
        sessionResponse.activity.result.createReadWriteSessionResultV2?.credentialBundle

      if (!credentialBundle) {
        authLogger.error("Failed to get credential bundle")
        throw new Error("Failed to get credential bundle")
      }
      authLogger.debug("Extracted credential bundle")

      // Create the session
      authLogger.debug("Creating session...")
      const session = await createSession({
        bundle: credentialBundle,
      })
      authLogger.debug("Created session")

      const walletAddress = session.user?.wallets[0].accounts[0].address as IEthereumAddress

      authLogger.debug("Creating XMTP client...")
      const { data: xmtpClient, error: xmtpError } = await tryCatch(
        createXmtpClient({
          inboxSigner: {
            getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
            getChainId: () => undefined,
            getBlockNumber: () => undefined,
            signerType: () => "EOA",
            signMessage: async (message: string) => {
              const sig = await signRawPayload({
                signWith: walletAddress,
                payload: message,
                encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
                hashFunction: "HASH_FUNCTION_KECCAK256",
              })

              // Convert RSV format to hex string
              const signature = `0x${sig.r}${sig.s}${sig.v}`

              return { signature }
            },
          },
        }),
      )
      authLogger.debug("XMTP client created")

      if (xmtpError) {
        throw xmtpError
      }

      if (!xmtpClient) {
        throw new Error("XMTP client creation failed")
      }

      const isValid = await validateXmtpInstallation({
        inboxId: xmtpClient.inboxId,
      })

      if (!isValid) {
        throw new Error("Invalid client installation")
      }

      useMultiInboxStore.getState().actions.setCurrentSender({
        ethereumAddress: walletAddress,
        inboxId: xmtpClient.inboxId,
      })

      await hydrateAuth()
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

      logout({ caller: "AuthContextProvider.login" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [createEmbeddedKey, createSession, signRawPayload, logout])

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

      console.log("authenticatorParams:", authenticatorParams)
      const ephemeralPublicKey = await createEmbeddedKey({
        isCompressed: true,
      })
      console.log("ephemeralPublicKey:", ephemeralPublicKey)

      // Step 2: Create a sub organization
      const { subOrgId, walletAddress } = await createSubOrganization({
        ephemeralPublicKey: ephemeralPublicKey,
        passkey: {
          challenge: authenticatorParams.challenge,
          attestation: authenticatorParams.attestation,
        },
      })

      console.log("subOrgId:", subOrgId)
      console.log("walletAddress:", walletAddress)

      // Step 3: Create a session
      await createSessionFromEmbeddedKey({
        subOrganizationId: subOrgId,
      })

      // Step 4: Create xmtp client
      const { data: xmtpClient, error: xmtpError } = await tryCatch(
        createXmtpClient({
          inboxSigner: {
            getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
            getChainId: () => undefined,
            getBlockNumber: () => undefined,
            signerType: () => "EOA",
            signMessage: async (message: string) => {
              const sig = await signRawPayload({
                signWith: walletAddress,
                payload: message,
                encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
                hashFunction: "HASH_FUNCTION_KECCAK256",
              })

              // Convert RSV format to hex string
              const signature = `0x${sig.r}${sig.s}${sig.v}`

              return { signature }
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
        ethereumAddress: walletAddress,
        inboxId: xmtpClient.inboxId,
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
  }, [createEmbeddedKey, createSessionFromEmbeddedKey, signRawPayload, logout])

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
