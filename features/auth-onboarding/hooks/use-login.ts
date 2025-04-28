import { TurnkeySigner } from "@turnkey/ethers"
import { isSupported, PasskeyStamper } from "@turnkey/react-native-passkey-stamper"
import { TurnkeyClient, useTurnkey } from "@turnkey/sdk-react-native"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import { ethers } from "ethers"
import { useCallback, useEffect, useRef } from "react"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { config } from "@/config"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { hydrateAuth } from "@/features/authentication/hydrate-auth"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { createXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { authLogger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"

export function useLogin() {
  const {
    createEmbeddedKey,
    createSession,
    client: turnkeyClient,
    signRawPayload,
    session,
  } = useTurnkey()

  const { logout } = useLogout()

  const isCreatingXmtpClient = useRef(false)

  useEffect(() => {
    if (isCreatingXmtpClient.current) {
      authLogger.debug("Already creating XMTP client")
      return
    }

    if (!turnkeyClient || !session) {
      authLogger.debug("No client or session")
      return
    }

    ;(async () => {
      try {
        const walletAddress = session.user?.wallets[0].accounts[0].address as IEthereumAddress

        console.log("walletAddress:", walletAddress)

        isCreatingXmtpClient.current = true

        const provider = new ethers.JsonRpcProvider(config.evm.rpcEndpoint)

        const turnkeySigner = new TurnkeySigner({
          client: turnkeyClient,
          organizationId: config.turnkey.organizationId,
          signWith: walletAddress,
        })
        const connectedSigner = turnkeySigner.connect(provider)

        const { data: xmtpClient, error: xmtpError } = await tryCatch(
          createXmtpClient({
            inboxSigner: {
              getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
              getChainId: () => undefined,
              getBlockNumber: () => undefined,
              signerType: () => "EOA",
              signMessage: async (message: string) => {
                const sig = await connectedSigner.signMessage(message)

                // const sig = await signRawPayload({
                //   signWith: walletAddress,
                //   payload: message,
                //   encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
                //   hashFunction: "HASH_FUNCTION_KECCAK256",
                // })

                // const signature = `0x${sig.r}${sig.s}${sig.v}`

                return { signature: sig }
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
        captureErrorWithToast(
          new AuthenticationError({ error, additionalMessage: "Failed to sign in with passkey" }),
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
  }, [turnkeyClient, session, signRawPayload, logout])

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
      authLogger.debug("Created passkey stamper")

      const httpClient = new TurnkeyClient({ baseUrl: "https://api.turnkey.com" }, stamper)
      authLogger.debug("Created HTTP client")

      const targetPublicKey = await createEmbeddedKey()
      authLogger.debug("Created embedded key:", targetPublicKey)

      const sessionResponse = await httpClient.createReadWriteSession({
        type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
        timestampMs: Date.now().toString(),
        organizationId: config.turnkey.organizationId,
        parameters: {
          targetPublicKey,
          expirationSeconds: "86400",
        },
      })
      authLogger.debug("Created read/write session")

      const credentialBundle =
        sessionResponse.activity.result.createReadWriteSessionResultV2?.credentialBundle

      if (!credentialBundle) {
        authLogger.error("Failed to get credential bundle")
        throw new Error("Failed to get credential bundle")
      }
      authLogger.debug("Extracted credential bundle")

      await createSession({
        bundle: credentialBundle,
      })
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

      logout({ caller: "useLogin" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [createEmbeddedKey, createSession, logout])

  return { login }
}
