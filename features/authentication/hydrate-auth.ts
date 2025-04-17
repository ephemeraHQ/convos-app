import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { useAppStore } from "@/stores/app-store"
import { captureError } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { authLogger } from "@/utils/logger/logger"
import { retryWithBackoff } from "@/utils/retryWithBackoff"

export async function hydrateAuth() {
  authLogger.debug("Hydrating auth...")

  const currentSender = getCurrentSender()

  if (!currentSender) {
    authLogger.debug("No current sender while hydrating auth so setting status to signed out...")
    useAuthenticationStore.getState().actions.setStatus("signedOut")
    return
  }

  try {
    const isInternetReachable = useAppStore.getState().isInternetReachable

    authLogger.debug("Is internet reachable: ", isInternetReachable)

    await retryWithBackoff({
      fn: () =>
        getXmtpClientByInboxId({
          inboxId: currentSender.inboxId,
        }),
      retries: 2,
      delay: 500,
    })

    // Don't do it with await because we prefer doing it in the background and letting user continue
    validateXmtpInstallation({
      inboxId: currentSender.inboxId,
    })
      .then((isValid) => {
        authLogger.debug(`XMTP installation is valid: ${isValid}`)
        if (!isValid) {
          authLogger.debug("Invalid XMTP installation while hydrating auth so signing out...")
          useAuthenticationStore.getState().actions.setStatus("signedOut")
        }
      })
      .catch(captureError)
  } catch (error) {
    captureError(
      new AuthenticationError({
        error,
        additionalMessage: "Error while hydrating auth so signing out...",
      }),
    )
    useAuthenticationStore.getState().actions.setStatus("signedOut")
    return
  }

  authLogger.debug("Successfully hydrated auth and setting status to signed in...")
  useAuthenticationStore.getState().actions.setStatus("signedIn")
}
