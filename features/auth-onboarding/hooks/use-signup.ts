import { createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper"
import { useTurnkey } from "@turnkey/sdk-react-native"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import { useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { config } from "@/config"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { createSubOrganization } from "@/features/authentication/authentication.api"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { createXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client-create"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { authLogger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"

export function useSignup() {
  const { createEmbeddedKey, createSessionFromEmbeddedKey, signRawPayload } = useTurnkey()
  const { logout } = useLogout()

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

      const authenticatorParams = await createPasskey({
        authenticatorName: "Passkey",
        rp: {
          id: config.app.webDomain,
          name: `https://${config.app.webDomain}`,
        },
        user: {
          id: uuidv4(),
          name: `Convos ${todayBeautifulString}`,
          displayName: `Convos ${todayBeautifulString}`,
        },
      })

      const ephemeralPublicKey = await createEmbeddedKey({
        isCompressed: true,
      })

      const { subOrgId, walletAddress } = await createSubOrganization({
        ephemeralPublicKey: ephemeralPublicKey,
        passkey: {
          challenge: authenticatorParams.challenge,
          attestation: authenticatorParams.attestation,
        },
      })

      await createSessionFromEmbeddedKey({
        subOrganizationId: subOrgId,
      })

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

      useMultiInboxStore.getState().actions.setCurrentSender({
        ethereumAddress: walletAddress,
        inboxId: xmtpClient.inboxId,
      })

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

      logout({ caller: "useSignup" }).catch(captureError)
      useAuthOnboardingStore.getState().actions.reset()
    } finally {
      useAuthOnboardingStore.getState().actions.setIsProcessingWeb3Stuff(false)
    }
  }, [createEmbeddedKey, createSessionFromEmbeddedKey, signRawPayload, logout])

  return { signup }
}
