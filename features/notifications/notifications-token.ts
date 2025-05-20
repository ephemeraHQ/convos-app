import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { config } from "@/config"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

export async function getDevicePushNotificationsToken() {
  try {
    if (!Device.isDevice) {
      // return "TEST_DEVICE_TOKEN"
      throw new Error("Must use physical")
    }

    let token

    const data = await Notifications.getDevicePushTokenAsync()

    // data.data is string for native platforms per DevicePushToken type
    // https://docs.expo.dev/versions/latest/sdk/notifications/#devicepushtoken
    token = data.data as string

    if (__DEV__) {
      notificationsLogger.debug("Device token:", token)
    }

    return token
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Error getting device push token",
    })
  }
}

export async function getExpoPushNotificationsToken() {
  try {
    if (!Device.isDevice) {
      // return "TEST_EXPO_TOKEN"
      throw new Error("Must use physical device for push notifications")
    }

    const data = await Notifications.getExpoPushTokenAsync({
      projectId: config.expo.projectId,
    })

    const expoToken = data.data as string

    if (__DEV__) {
      notificationsLogger.debug("Expo token:", expoToken)
    }

    return expoToken
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Failed to get Expo push token",
    })
  }
}
