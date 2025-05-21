import { useEffect } from "react"
import { config } from "@/config"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useCurrentUserQuery } from "@/features/current-user/current-user.query"
import { updateDevice } from "@/features/devices/devices.api"
import { getDeviceName, getDeviceOs } from "@/features/devices/devices.utils"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { captureError } from "@/utils/capture-error"
import { logger } from "@/utils/logger/logger"

export function useStartListeningToCurrentUserQuery() {
  const { data: currentUser } = useCurrentUserQuery()
  const authStatus = useAuthenticationStore((s) => s.status)

  useEffect(() => {
    if (!currentUser?.id || authStatus !== "signedIn") {
      return
    }

    // Register push notifications
    registerPushNotifications().catch(captureError)

    // Update the device data
    ensureUserDeviceQueryData({
      userId: currentUser.id,
    }).then((device) => {
      const appBuildNumber = String(config.app.buildNumber)
      const appVersion = String(config.app.version)
      return updateDevice({
        userId: currentUser.id,
        deviceId: device.id,
        updates: {
          name: getDeviceName(),
          os: getDeviceOs(),
          appBuildNumber,
          appVersion,
        },
      })
        .then(() => {
          logger.debug(
            `Updated device data with appBuildNumber ${appBuildNumber} and appVersion ${appVersion}`,
          )
        })
        .catch(captureError)
    })
  }, [currentUser?.id, authStatus])
}
