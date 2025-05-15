import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { requestNotificationsPermissions } from "@/features/notifications/notifications-permissions"
import {
  getDevicePushNotificationsToken,
  getExpoPushNotificationsToken,
} from "@/features/notifications/notifications-token"
import {
  registerNotificationInstallation,
  unregisterNotificationInstallation,
} from "@/features/notifications/notifications.api"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
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
    const client = await getXmtpClientByInboxId({
      inboxId: currentSender.inboxId,
    })

    await registerNotificationInstallation({
      deviceId: currentDevice.id,
      identityId: currentUser.identities[0].id, // TODO: Add support for multiple identities
      xmtpInstallationId: client.installationId,
      expoToken,
      pushToken: deviceToken,
    })
  } catch (error) {
    // Catch any error from the steps above and wrap it
    throw new NotificationError({
      error,
      additionalMessage: "Failed to register push notifications",
    })
  }
}

export async function unregisterPushNotifications(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  await unregisterNotificationInstallation({
    installationId: client.installationId,
  })
}
