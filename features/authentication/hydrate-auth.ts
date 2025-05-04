import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getAllSenders, getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { startStreaming } from "@/features/streams/streams"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { isXmtpNoNetworkError } from "@/features/xmtp/xmtp-errors"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { useAppStore } from "@/stores/app-store"
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
    if (isXmtpNoNetworkError(error) || !useAppStore.getState().isInternetReachable) {
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
  login()
}

function login() {
  useAuthenticationStore.getState().actions.setStatus("signedIn")

  const senders = getAllSenders()

  startStreaming(senders.map((sender) => sender.inboxId)).catch(captureError)
}
