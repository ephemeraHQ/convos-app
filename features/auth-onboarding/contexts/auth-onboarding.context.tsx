import { createPasskey, isSupported, PasskeyStamper } from "@turnkey/react-native-passkey-stamper"
import { TurnkeyClient, useTurnkey } from "@turnkey/sdk-react-native"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { v4 as uuidv4 } from "uuid"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { config } from "@/config"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { createSubOrganization } from "@/features/authentication/authentication.api"
import { useHydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { useCreateXmtpSignerFromTurnkey } from "@/features/wallets/hooks/use-create-xmtp-signer-from-turnkey"
import { createXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client-create"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { getHumanReadableDateWithTime } from "@/utils/date"
import { AuthenticationError, ensureError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { authLogger } from "@/utils/logger/logger"
import { TimeUtils } from "@/utils/time.utils"
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

const errorsToIgnore = [
  "com.apple.AuthenticationServices.AuthorizationError error 1001", // User cancelled the passkey registration
]

export const AuthOnboardingContextProvider = (props: IAuthOnboardingContextProps) => {
  const { children } = props
  const {
    createEmbeddedKey,
    createSession,
    createSessionFromEmbeddedKey,
    client: turnkeyClient,
    session,
    clearAllSessions,
  } = useTurnkey()

  const { logout } = useLogout()
  const { hydrateAuth } = useHydrateAuth()

  const createXmtpSignerFromTurnkey = useCreateXmtpSignerFromTurnkey()

  const flowType = useRef<"login" | "signup">("login")
  const isCreatingXmtpClient = useRef(false)
  const [readyForXmtpClient, setReadyForXmtpClient] = useState(false)

  useEffect(() => {
    return () => {
      authLogger.debug("AuthOnboardingContextProvider unmounted, resetting state")
      useAuthOnboardingStore.getState().actions.reset()
    }
  }, [])

  useEffect(() => {
    if (isCreatingXmtpClient.current || !turnkeyClient || !session || !readyForXmtpClient) {
      return
    }

    ;(async () => {
      try {
        const walletAddress = session.user?.wallets[0].accounts[0].address as IEthereumAddress

        isCreatingXmtpClient.current = true
        authLogger.debug(`Creating XMTP client for wallet: ${walletAddress}`)

        const { data: xmtpClient, error: xmtpError } = await tryCatch(
          createXmtpClient({
            inboxSigner: createXmtpSignerFromTurnkey(),
          }),
        )

        if (xmtpError) {
          throw xmtpError
        }

        if (!xmtpClient) {
          throw new Error("XMTP client creation failed")
        }

        authLogger.debug("XMTP client created successfully")

        authLogger.debug("Validating XMTP installation")
        const isValid = await validateXmtpInstallation({
          inboxId: xmtpClient.inboxId,
        })

        if (!isValid) {
          throw new Error("Invalid client installation")
        }
        authLogger.debug("XMTP installation validated successfully")

        useMultiInboxStore.getState().actions.setCurrentSender({
          ethereumAddress: walletAddress,
          inboxId: xmtpClient.inboxId,
        })

        if (flowType.current === "login") {
          authLogger.debug("Login flow detected, hydrating auth")
          await hydrateAuth()
        } else {
          authLogger.debug("Signup flow detected, moving to contact card")
          useAuthOnboardingStore.getState().actions.setPage("contact-card")
        }
      } catch (error) {
        captureErrorWithToast(
          new AuthenticationError({
            error,
            additionalMessage: "Failed to create XMTP client flow",
          }),
          {
            message: "Failed to sign in with passkey",
          },
        )
        logout({ caller: "useLogin" }).catch(captureError)
        useAuthOnboardingStore.getState().actions.reset()
      } finally {
        isCreatingXmtpClient.current = false
        useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
      }
    })()
  }, [turnkeyClient, session, logout, readyForXmtpClient, createXmtpSignerFromTurnkey, hydrateAuth])

  const login = useCallback(async () => {
    if (!isSupported()) {
      showSnackbar({
        message: "Passkeys are not supported on this device",
        type: "error",
      })
      return
    }

    try {
      authLogger.debug("Starting login flow")
      flowType.current = "login"
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(true)

      // Clear all sessions to avoid issues with Turnkey auth
      authLogger.debug("Clearing all Turnkey sessions")
      await clearAllSessions()
      authLogger.debug("All Turnkey sessions cleared")

      authLogger.debug("Creating PasskeyStamper")
      const stamper = new PasskeyStamper({
        rpId: config.app.webDomain,
      })

      const httpClient = new TurnkeyClient({ baseUrl: config.turnkey.turnkeyApiUrl }, stamper)

      authLogger.debug("Creating embedded key")
      const targetPublicKey = await createEmbeddedKey()
      authLogger.debug("Embedded key created")

      authLogger.debug("Creating read-write session")
      const sessionResponse = await httpClient.createReadWriteSession({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: config.turnkey.organizationId, // Parent org ID
        parameters: {
          targetPublicKey,
          expirationSeconds: TimeUtils.days(60).toSeconds().toString(),
        },
      })
      authLogger.debug("Read-write session response received")

      const credentialBundle =
        sessionResponse.activity.result.createReadWriteSessionResultV2?.credentialBundle

      if (!credentialBundle) {
        throw new Error("Failed to get credential bundle")
      }

      authLogger.debug("Creating session with credential bundle")
      await createSession({
        bundle: credentialBundle,
        expirationSeconds: TimeUtils.days(60).toSeconds(),
      })
      authLogger.debug("Session created successfully")

      setReadyForXmtpClient(true)
    } catch (error) {
      const ensuredError = ensureError(error)

      if (!errorsToIgnore.some((e) => ensuredError.message.includes(e))) {
        captureErrorWithToast(
          new AuthenticationError({ error, additionalMessage: "Failed to sign in with passkey" }),
          {
            message: "Failed to sign in with passkey",
          },
        )
      }

      logout({ caller: "AuthContextProvider.login" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
    } finally {
      setReadyForXmtpClient(false)
    }
  }, [createEmbeddedKey, createSession, logout, clearAllSessions])

  const signup = useCallback(async () => {
    if (!isSupported()) {
      showSnackbar({
        message: "Passkeys are not supported on this device",
        type: "error",
      })
      return
    }

    try {
      authLogger.debug("Starting signup flow")
      flowType.current = "signup"
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(true)

      // Clear all sessions to avoid issues with Turnkey auth
      authLogger.debug("Clearing all Turnkey sessions")
      await clearAllSessions()
      authLogger.debug("All Turnkey sessions cleared")

      const todayBeautifulString = getHumanReadableDateWithTime(new Date())
      const passkeyName = `Convos ${todayBeautifulString}`

      authLogger.debug("Creating passkey")
      const authenticatorParams = await createPasskey({
        authenticatorName: "Passkey",
        rp: {
          id: config.app.webDomain,
          name: `https://${config.app.webDomain}`,
        },
        user: {
          id: uuidv4(),
          name: passkeyName,
          displayName: passkeyName,
        },
      })
      authLogger.debug("Passkey created successfully")

      authLogger.debug("Creating embedded key")
      const ephemeralPublicKey = await createEmbeddedKey({
        isCompressed: true,
      })
      authLogger.debug("Embedded key created")

      authLogger.debug("Creating sub organization")
      const { subOrgId } = await createSubOrganization({
        ephemeralPublicKey: ephemeralPublicKey,
        passkey: {
          challenge: authenticatorParams.challenge,
          attestation: authenticatorParams.attestation,
        },
      })
      authLogger.debug(`Sub organization created with ID: ${subOrgId}`)

      authLogger.debug("Creating session from embedded key")
      await createSessionFromEmbeddedKey({
        subOrganizationId: subOrgId,
        expirationSeconds: TimeUtils.days(60).toSeconds(),
      })
      authLogger.debug("Session created successfully")

      setReadyForXmtpClient(true)
    } catch (error) {
      const ensuredError = ensureError(error)

      if (!errorsToIgnore.some((e) => ensuredError.message.includes(e))) {
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
      setReadyForXmtpClient(false)
    }
  }, [createEmbeddedKey, createSessionFromEmbeddedKey, logout, clearAllSessions])

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
