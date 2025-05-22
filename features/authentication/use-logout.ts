import { useTurnkey } from "@turnkey/sdk-react-native"
import { useCallback } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getAllSenders, resetMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { unlinkIdentityFromDeviceMutation } from "@/features/convos-identities/convos-identities-remove.mutation"
import { ensureUserIdentitiesQueryData } from "@/features/convos-identities/convos-identities.query"
import { getCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { unsubscribeFromAllConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
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

      useAppStore.getState().actions.setIsShowingFullScreenOverlay(true)
      useAppStore.getState().actions.setIsLoggingOut(true)

      try {
        const senders = getAllSenders()
        const hasAtLeastOneSender = senders.length > 0

        if (hasAtLeastOneSender) {
          const [unsubscribeNotificationsResults, streamingResult, unlinkIdentitiesResults] =
            await customPromiseAllSettled([
              // Unsubscribe from conversations notifications
              Promise.all(
                senders.map((sender) =>
                  unsubscribeFromAllConversationsNotifications({
                    clientInboxId: sender.inboxId,
                  }),
                ),
              ),
              // Stop streaming
              stopStreaming(senders.map((sender) => sender.inboxId)),
              // Unlink identities from device
              new Promise<void>(async (resolve, reject) => {
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
                    currentUserIdentities.map((identity) =>
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
        }

        try {
          await clearTurnkeySessions()
        } catch (error) {
          captureError(
            new GenericError({ error, additionalMessage: "Error clearing turnkey sessions" }),
          )
        }

        // Doing this at the end because we want to make sure that we cleared everything before showing auth screen
        useAuthenticationStore.getState().actions.setStatus("signedOut")

        // This needs to be at the end because at many places we use useSafeCurrentSender()
        // and it will throw error if we reset the store too early
        // Need the setTimeout because for some reason the navigation is not updated immediately when we set auth status to signed out
        resetMultiInboxStore()

        // Might want to only clear certain queries later but okay for now
        // Put this last because otherwise some useQuery hook triggers even tho we're logging out
        clearReacyQueryQueriesAndCache()

        authLogger.debug("Successfully logged out")
      } catch (error) {
        throw new GenericError({
          error,
          additionalMessage: "Error logging out",
        })
      } finally {
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

        useAppStore.getState().actions.setIsShowingFullScreenOverlay(false)
        useAppStore.getState().actions.setIsLoggingOut(false)
      }
    },
    [clearTurnkeySessions],
  )

  return { logout }
}
