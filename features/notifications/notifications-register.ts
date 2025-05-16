import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureUserIdentitiesQueryData } from "@/features/convos-identities/convos-identities.query"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { requestNotificationsPermissions } from "@/features/notifications/notifications-permissions"
import {
  getDevicePushNotificationsToken,
  getExpoPushNotificationsToken,
} from "@/features/notifications/notifications-token"
import { registerNotificationInstallation } from "@/features/notifications/notifications.api"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { NotificationError, UserCancelledError } from "@/utils/error"

export async function registerPushNotifications() {
  try {
    const result = await requestNotificationsPermissions()

    if (!result.granted) {
      throw new UserCancelledError({ error: "Notifications permissions not granted" })
    }

    const currentUser = await ensureCurrentUserQueryData({ caller: "registerPushNotifications" })

    if (!currentUser) {
      throw new NotificationError({
        error: "No current user found to register push notifications",
      })
    }

    const currentDevice = await ensureUserDeviceQueryData({
      userId: currentUser.id,
    })

    if (!currentDevice) {
      throw new NotificationError({
        error: "No current device found to register push notifications",
      })
    }

    const [deviceToken, expoToken] = await Promise.all([
      getDevicePushNotificationsToken(),
      getExpoPushNotificationsToken(),
    ])

    const currentSender = getSafeCurrentSender()
    const identities = await ensureUserIdentitiesQueryData({ userId: currentUser.id })

    await registerNotificationInstallation({
      deviceId: currentDevice.id,
      expoToken,
      pushToken: deviceToken,
      installations: await Promise.all(
        identities.map(async (identity) => {
          const client = await getXmtpClientByInboxId({
            inboxId: currentSender.inboxId,
          })
          return {
            identityId: identity.id,
            xmtpInstallationId: client.installationId,
          }
        }),
      ),
    })
  } catch (error) {
    // Catch any error from the steps above and wrap it
    throw new NotificationError({
      error,
      additionalMessage: "Failed to register push notifications",
    })
  }
}
