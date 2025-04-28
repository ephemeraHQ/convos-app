import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { isXmtpNoNetworkError } from "@/features/xmtp/xmtp-errors"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { captureError } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { authLogger } from "@/utils/logger/logger"

export async function hydrateAuth() {
  authLogger.debug("Hydrating auth...")

  const currentSender = getCurrentSender()

  if (!currentSender) {
    authLogger.debug("No current sender while hydrating auth so setting status to signed out...")
    useAuthenticationStore.getState().actions.setStatus("signedOut")
    return
  }

  getXmtpClientByInboxId({
    inboxId: currentSender.inboxId,
  }).catch((error) => {
    if (isXmtpNoNetworkError(error)) {
      authLogger.debug("No network error while hydrating auth so just returning...")
      return
    }

    captureError(
      new AuthenticationError({
        error,
        additionalMessage: "Error while hydrating auth so signing out...",
      }),
    )
    useAuthenticationStore.getState().actions.setStatus("signedOut")
    return
  })

  // Don't do it with await because we prefer doing it in the background and letting user continue
  validateXmtpInstallation({
    inboxId: currentSender.inboxId,
  })
    .then((isValid) => {
      if (!isValid) {
        authLogger.debug("Invalid XMTP installation while hydrating auth so signing out...")
        useAuthenticationStore.getState().actions.setStatus("signedOut")
      } else {
        authLogger.debug("Valid XMTP installation")
      }
    })
    .catch(captureError)

  authLogger.debug("Successfully hydrated auth and setting status to signed in...")
  useAuthenticationStore.getState().actions.setStatus("signedIn")
}
