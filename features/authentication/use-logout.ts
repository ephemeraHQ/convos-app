import { useTurnkey } from "@turnkey/sdk-react-native"
import { useCallback } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getAllSenders, useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { unregisterBackgroundSyncTask } from "@/features/background-sync/background-sync"
import { unlinkIdentityFromDeviceMutation } from "@/features/convos-identities/convos-identities-remove.mutation"
import { ensureUserIdentitiesQueryData } from "@/features/convos-identities/convos-identities.query"
import { getCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { unsubscribeFromAllConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
import { unregisterPushNotifications } from "@/features/notifications/notifications-register"
import { useNotificationsStore } from "@/features/notifications/notifications.store"
import { stopStreaming } from "@/features/streams/streams"
import { logoutXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client"
import { useAppStore } from "@/stores/app.store"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { clearImageCache } from "@/utils/image"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"
import { clearReacyQueryQueriesAndCache } from "@/utils/react-query/react-query.utils"
import { authLogger } from "../../utils/logger/logger"

export const useLogout = () => {
  const { clearAllSessions: clearTurnkeySessions } = useTurnkey()

  const logout = useCallback(
    async (args: { caller: string }) => {
      authLogger.debug(`Logging out called by "${args.caller}"`)

      // Immediately log out the user
      useAuthenticationStore.getState().actions.setStatus("signedOut")
      useMultiInboxStore.getState().actions.reset()
      useNotificationsStore.getState().actions.reset()
      clearReacyQueryQueriesAndCache()

      authLogger.debug("User logged out immediately")

      // Run cleanup operations in the background
      const runCleanupInBackground = async (): Promise<void> => {
        try {
          const senders = getAllSenders()
          const hasAtLeastOneSender = senders.length > 0

          if (hasAtLeastOneSender) {
            const [
              unsubscribeNotificationsResults,
              streamingResult,
              unlinkIdentitiesResults,
              unregisterPushNotificationsResults,
              unregisterBackgroundTaskResult,
            ] = await customPromiseAllSettled([
              // Unsubscribe from conversations notifications
              Promise.all(
                senders.map((sender: { inboxId: string }) =>
                  unsubscribeFromAllConversationsNotifications({
                    clientInboxId: sender.inboxId,
                  }),
                ),
              ),
              // Stop streaming
              stopStreaming(senders.map((sender: { inboxId: string }) => sender.inboxId)),
              // Unlink identities from device
              new Promise<void>(async (resolve: () => void, reject: (error: any) => void) => {
                try {
                  const currentUser = getCurrentUserQueryData()
                  if (!currentUser) {
                    // Ignore the flow if we don't have a current user
                    return resolve()
                  }
                  const currentDevice = await ensureUserDeviceQueryData({
                    userId: currentUser.id,
                  })
                  const currentUserIdentities = await ensureUserIdentitiesQueryData({
                    userId: currentUser.id,
                  })
                  await Promise.all(
                    currentUserIdentities.map((identity: { id: string }) =>
                      unlinkIdentityFromDeviceMutation({
                        identityId: identity.id,
                        deviceId: currentDevice.id,
                      }),
                    ),
                  )
                  resolve()
                } catch (error) {
                  reject(error)
                }
              }),
              // Unregister push notifications
              Promise.all(
                senders.map((sender: { inboxId: string }) =>
                  unregisterPushNotifications({ clientInboxId: sender.inboxId }),
                ),
              ),
              // Unregister background sync task
              unregisterBackgroundSyncTask(),
            ])

            if (unsubscribeNotificationsResults.status === "rejected") {
              captureError(
                new GenericError({
                  error: unsubscribeNotificationsResults.reason,
                  additionalMessage: "Error unsubscribing from conversations notifications",
                }),
              )
            }

            if (streamingResult.status === "rejected") {
              captureError(
                new GenericError({
                  error: streamingResult.reason,
                  additionalMessage: "Error stopping streaming",
                }),
              )
            }

            if (unlinkIdentitiesResults.status === "rejected") {
              captureError(
                new GenericError({
                  error: unlinkIdentitiesResults.reason,
                  additionalMessage: "Error unregistering push notifications",
                }),
              )
            }

            if (unregisterPushNotificationsResults.status === "rejected") {
              captureError(
                new GenericError({
                  error: unregisterPushNotificationsResults.reason,
                  additionalMessage: "Error unregistering push notifications",
                }),
              )
            }

            if (unregisterBackgroundTaskResult.status === "rejected") {
              captureError(
                new GenericError({
                  error: unregisterBackgroundTaskResult.reason,
                  additionalMessage: "Error unregistering background sync task",
                }),
              )
            }

            try {
              await Promise.all(
                senders.map((sender) =>
                  logoutXmtpClient({
                    inboxId: sender.inboxId,
                    ethAddress: sender.ethereumAddress,
                  }),
                ),
              )
            } catch (error) {
              captureError(new GenericError({ error, additionalMessage: "Error logging out xmtp" }))
            }
          }

          try {
            await clearTurnkeySessions()
          } catch (error) {
            captureError(
              new GenericError({ error, additionalMessage: "Error clearing turnkey sessions" }),
            )
          }

          // Clear expo-image cache after logout for privacy and to avoid stale images
          try {
            await clearImageCache()
          } catch (e) {
            captureError(
              new GenericError({
                error: e,
                additionalMessage: "Error clearing image cache after logout",
              }),
            )
          }

          authLogger.debug("Background cleanup operations completed")
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error during logout cleanup operations",
            }),
          )
        }
      }

      // Execute cleanup in background without awaiting
      runCleanupInBackground()
    },
    [clearTurnkeySessions],
  )

  return { logout }
}
