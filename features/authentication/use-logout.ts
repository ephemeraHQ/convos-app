import { usePrivy } from "@privy-io/expo"
import { useCallback } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender, resetMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { logoutXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { clearReacyQueryQueriesAndCache } from "@/utils/react-query/react-query.utils"
import { authLogger } from "../../utils/logger/logger"

export const useLogout = () => {
  const { logout: privyLogout } = usePrivy()

  const logout = useCallback(
    async (args: { caller: string }) => {
      authLogger.debug(`Logging out called by ${args.caller}`)

      try {
        // First doing this so that all places
        useAuthenticationStore.getState().actions.setStatus("signedOut")

        const currentSender = getCurrentSender()

        // TODO: Change this once we support multiple identities
        resetMultiInboxStore()

        if (currentSender) {
          logoutXmtpClient({
            inboxId: currentSender.inboxId,
          }).catch(captureError)
        }

        await privyLogout()

        clearReacyQueryQueriesAndCache()

        authLogger.debug("Successfully logged out")
      } catch (error) {
        throw new GenericError({
          error,
          additionalMessage: "Error logging out",
        })
      }
    },
    // Don't add privyLogout to the dependencies array. It's useless and cause lots of re-renders of callers
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return { logout }
}
