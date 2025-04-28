import { useTurnkey } from "@turnkey/sdk-react-native"
import { useCallback } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender, resetMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { unregisterBackgroundNotificationTask } from "@/features/notifications/background-notifications-handler"
import { unsubscribeFromAllConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
import { logoutXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { clearReacyQueryQueriesAndCache } from "@/utils/react-query/react-query.utils"
import { authLogger } from "../../utils/logger/logger"

export const useLogout = () => {
  const { clearSession: clearTurnkeySession } = useTurnkey()

  const logout = useCallback(
    async (args: { caller: string }) => {
      authLogger.debug(`Logging out called by ${args.caller}`)

      try {
        const currentSender = getCurrentSender()

        // Unsubscribe from all conversations notifications
        if (currentSender) {
          try {
            await unsubscribeFromAllConversationsNotifications({
              clientInboxId: currentSender.inboxId,
            })
          } catch (error) {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error unsubscribing from conversations notifications",
              }),
            )
          }
        }

        try {
          await unregisterBackgroundNotificationTask()
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error unregistering background notification task",
            }),
          )
        }

        if (currentSender) {
          logoutXmtpClient({
            inboxId: currentSender.inboxId,
          }).catch(captureError)
        }

        await clearTurnkeySession()

        // Might want to only clear certain queries later but okay for now
        clearReacyQueryQueriesAndCache()

        // Doing this at the end because we want to make sure that we cleared everything before showing auth screen
        useAuthenticationStore.getState().actions.setStatus("signedOut")

        // This needs to be last
        resetMultiInboxStore()

        authLogger.debug("Successfully logged out")
      } catch (error) {
        throw new GenericError({
          error,
          additionalMessage: "Error logging out",
        })
      }
    },
    [clearTurnkeySession],
  )

  return { logout }
}
