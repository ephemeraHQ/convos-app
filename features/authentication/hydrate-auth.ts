import { useCallback } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { isXmtpNoNetworkError } from "@/features/xmtp/xmtp-errors"
import { validateXmtpInstallation } from "@/features/xmtp/xmtp-installations/xmtp-installations"
import { useAppStore } from "@/stores/app-store"
import { captureError } from "@/utils/capture-error"
import { AuthenticationError, BaseError, ExternalCancellationError } from "@/utils/error"
import { authLogger } from "@/utils/logger/logger"

export function useHydrateAuth() {
  const { logout } = useLogout()

  const hydrateAuth = useCallback(() => {
    authLogger.debug("Hydrating auth...")

    const currentSender = getCurrentSender()

    if (!currentSender) {
      authLogger.debug("No current sender while hydrating auth so setting status to signed out...")
      logout({ caller: "useHydrateAuth no current sender" })
      return
    }

    getXmtpClientByInboxId({
      inboxId: currentSender.inboxId,
    }).catch((error) => {
      if (isXmtpNoNetworkError(error) || !useAppStore.getState().isInternetReachable) {
        authLogger.debug("No network error while hydrating auth so just returning...")
        return
      }

      if (error instanceof BaseError && error.hasErrorType(ExternalCancellationError)) {
        authLogger.debug("External cancellation error while hydrating auth so just returning...")
        return
      }

      captureError(
        new AuthenticationError({
          error,
          additionalMessage: "Error while hydrating auth so signing out...",
        }),
      )
      logout({ caller: "useHydrateAuth xmtp client error" }).catch(captureError)
      return
    })

    // Don't do it with await because we prefer doing it in the background and letting user continue
    validateXmtpInstallation({
      inboxId: currentSender.inboxId,
    })
      .then((isValid) => {
        if (!isValid) {
          authLogger.debug("Invalid XMTP installation while hydrating auth so signing out...")
          logout({ caller: "useHydrateAuth xmtp installation error" }).catch(captureError)
        } else {
          authLogger.debug("Valid XMTP installation")
        }
      })
      .catch(captureError)

    authLogger.debug("Successfully hydrated auth and setting status to signed in...")
    useAuthenticationStore.getState().actions.setStatus("signedIn")
  }, [logout])

  return { hydrateAuth }
}
