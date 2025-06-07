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
import { clearReacyQueryQueriesAndCache } from "@/utils/react-query/react-query.utils"
import { authLogger } from "../../utils/logger/logger"

export const useLogout = () => {
  const { clearAllSessions: clearTurnkeySessions } = useTurnkey()

  const logout = useCallback(
    async (args: { caller: string }) => {
      authLogger.debug(`Logging out called by "${args.caller}"`)

      useAppStore.getState().actions.setIsShowingFullScreenOverlay(true)
      useAppStore.getState().actions.setIsLoggingOut(true)

      try {
        const senders = getAllSenders()
        const hasAtLeastOneSender = senders.length > 0

        if (hasAtLeastOneSender) {
          // Fire off all cleanup operations in the background without awaiting
          // Unsubscribe from conversations notifications
          void Promise.all(
            senders.map((sender) =>
              unsubscribeFromAllConversationsNotifications({
                clientInboxId: sender.inboxId,
              }),
            ),
          ).catch((error: unknown) => {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error unsubscribing from conversations notifications",
              }),
            )
          })

          // Stop streaming
          void stopStreaming(senders.map((sender) => sender.inboxId)).catch((error: unknown) => {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error stopping streaming",
              }),
            )
          })

          // Unlink identities from device
          void (async () => {
            try {
              const currentUser = getCurrentUserQueryData()
              if (!currentUser) {
                return
              }
              const currentDevice = await ensureUserDeviceQueryData({
                userId: currentUser.id,
              })
              const currentUserIdentities = await ensureUserIdentitiesQueryData({
                userId: currentUser.id,
              })
              await Promise.all(
                currentUserIdentities.map((identity) =>
                  unlinkIdentityFromDeviceMutation({
                    identityId: identity.id,
                    deviceId: currentDevice.id,
                  }),
                ),
              )
            } catch (error) {
              captureError(
                new GenericError({
                  error,
                  additionalMessage: "Error unlinking identities from device",
                }),
              )
            }
          })()

          // Unregister push notifications
          void Promise.all(
            senders.map((sender) =>
              unregisterPushNotifications({ clientInboxId: sender.inboxId }),
            ),
          ).catch((error: unknown) => {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error unregistering push notifications",
              }),
            )
          })

          // Unregister background sync task
          void unregisterBackgroundSyncTask().catch((error: unknown) => {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error unregistering background sync task",
              }),
            )
          })

          // Logout XMTP clients
          void Promise.all(
            senders.map((sender) =>
              logoutXmtpClient({
                inboxId: sender.inboxId,
                ethAddress: sender.ethereumAddress,
              }),
            ),
          ).catch((error: unknown) => {
            captureError(new GenericError({ error, additionalMessage: "Error logging out xmtp" }))
          })
        }

        // Clear Turnkey sessions in the background
        void clearTurnkeySessions().catch((error: unknown) => {
          captureError(
            new GenericError({ error, additionalMessage: "Error clearing turnkey sessions" }),
          )
        })

        // Clear image cache in the background
        void clearImageCache().catch((error: unknown) => {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error clearing image cache after logout",
            }),
          )
        })

        // Immediately proceed with setting auth status and clearing stores
        useAuthenticationStore.getState().actions.setStatus("signedOut")
        useMultiInboxStore.getState().actions.reset()
        useNotificationsStore.getState().actions.reset()
        clearReacyQueryQueriesAndCache()

        authLogger.debug("Successfully initiated logout")

        // Give a small delay before hiding the overlay to ensure smooth transition
        setTimeout(() => {
          useAppStore.getState().actions.setIsShowingFullScreenOverlay(false)
          useAppStore.getState().actions.setIsLoggingOut(false)
        }, 500)
      } catch (error) {
        useAppStore.getState().actions.setIsShowingFullScreenOverlay(false)
        useAppStore.getState().actions.setIsLoggingOut(false)
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
