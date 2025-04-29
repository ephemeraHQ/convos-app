import { useTurnkey } from "@turnkey/sdk-react-native"
import { useCallback } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getAllSenders, resetMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { unregisterBackgroundNotificationTask } from "@/features/notifications/background-notifications-handler"
import { unsubscribeFromAllConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
import { stopStreaming } from "@/features/streams/streams"
import { logoutXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { clearReacyQueryQueriesAndCache } from "@/utils/react-query/react-query.utils"
import { authLogger } from "../../utils/logger/logger"

export const useLogout = () => {
  const { clearAllSessions: clearTurnkeySessions } = useTurnkey()

  const logout = useCallback(
    async (args: { caller: string }) => {
      authLogger.debug(`Logging out called by "${args.caller}"`)

      try {
        const senders = getAllSenders()

        try {
          await Promise.all(
            senders.map(async (sender) => {
              await unsubscribeFromAllConversationsNotifications({
                clientInboxId: sender.inboxId,
              })
            }),
          )
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error unsubscribing from conversations notifications",
            }),
          )
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

        try {
          await stopStreaming(senders.map((sender) => sender.inboxId))
        } catch (error) {
          captureError(new GenericError({ error, additionalMessage: "Error stopping streaming" }))
        }

        try {
          await Promise.all(
            senders.map((sender) =>
              logoutXmtpClient({
                inboxId: sender.inboxId,
              }),
            ),
          )
        } catch (error) {
          captureError(new GenericError({ error, additionalMessage: "Error logging out xmtp" }))
        }

        await clearTurnkeySessions()

        // Doing this at the end because we want to make sure that we cleared everything before showing auth screen
        useAuthenticationStore.getState().actions.setStatus("signedOut")

        // This needs to be at the end because at many places we use useSafeCurrentSender()
        // and it will throw error if we reset the store too early
        // Need the setTimeout because for some reason the navigation is not updated immediately when we set auth status to signed out
        setTimeout(() => {
          resetMultiInboxStore()
        }, 0)

        // Might want to only clear certain queries later but okay for now
        // Put this last because otherwise some useQuery hook triggers even tho we're logging out
        clearReacyQueryQueriesAndCache()

        authLogger.debug("Successfully logged out")
      } catch (error) {
        throw new GenericError({
          error,
          additionalMessage: "Error logging out",
        })
      }
    },
    [clearTurnkeySessions],
  )

  return { logout }
}
