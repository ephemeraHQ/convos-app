import Clipboard from "@react-native-clipboard/clipboard"
import Constants from "expo-constants"
import { Image } from "expo-image"
import * as Notifications from "expo-notifications"
import * as Updates from "expo-updates"
import { memo, useCallback, useMemo, Fragment } from "react"
import { Alert, Platform } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { runOnJS } from "react-native-reanimated"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { useXmtpLogFilesModalStore } from "@/components/xmtp-log-files-modal"
import { config } from "@/config"
import { useLogout } from "@/features/authentication/use-logout"
import { requestNotificationsPermissions } from "@/features/notifications/notifications-permissions"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { getDevicePushNotificationsToken } from "@/features/notifications/notifications-token"
import {
  canAskForNotificationsPermissions,
  userHasGrantedNotificationsPermissions,
} from "@/features/notifications/notifications.service"
import {
  clearXmtpLogFiles,
  clearXmtpLogs,
  getXmtpLogFile,
  startXmtpFileLogging,
  stopXmtpFileLogging,
} from "@/features/xmtp/xmtp-logs"
import { translate } from "@/i18n"
import { navigate } from "@/navigation/navigation.utils"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { getEnv } from "@/utils/getEnv"
import { Haptics } from "@/utils/haptics"
import { clearLogFile, LOG_FILE_PATH } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { shareContent } from "@/utils/share"
import { reactQueryPersistingStorage } from "@/utils/storage/storages"
import { showActionSheet } from "./action-sheet"
import { currentUserIsDebugUser } from "@/features/authentication/utils/debug-user.utils"

export const DebugMenuWrapper = memo(function DebugWrapper(props: { children: React.ReactNode }) {
  const { children } = props

  // Only enable debug menu for debug users. Add a debug user by adding their lowercase Ethereum address to config.debugEthAddresses.
  const isDebugUser = currentUserIsDebugUser()

  const showDebugMenu = useShowDebugMenu()

  const longPressGesture = Gesture.LongPress()
    .onStart(() => {
      Haptics.softImpactAsyncAnimated()
      runOnJS(showDebugMenu)()
    })
    .minDuration(1000)

  // For non-debug users, simply render the children directly without the debug gesture
  // This makes the component act as a pass-through, preserving the normal UI
  if (!isDebugUser) {
    return children
  }

  return <GestureDetector gesture={longPressGesture}>{children}</GestureDetector>
})

function useShowDebugMenu() {
  const { logout } = useLogout()
  const { currentlyRunning } = Updates.useUpdates()

  const showLogsMenu = useCallback(() => {
    const logsMethods = {
      "Clear current log session": () => {
        clearLogFile().catch(captureError)
      },
      "Share current session logs": () => {
        shareContent({
          title: "Convos current logs",
          url: `file://${LOG_FILE_PATH}`,
          type: "text/plain",
        }).catch(captureError)
      },
      "Display current session logs": async () => {
        navigate("WebviewPreview", { uri: LOG_FILE_PATH }).catch(captureError)
      },
      "Start Libxmtp File Logging": async () => {
        startXmtpFileLogging()
        showSnackbar({
          message: "XMTP log files started",
        })
      },
      "Stop Libxmtp File Logging": async () => {
        stopXmtpFileLogging()
        showSnackbar({
          message: "XMTP log files stopped",
        })
      },
      "View Libxmtp File Logs": async () => {
        useXmtpLogFilesModalStore.getState().actions.setVisible(true)
      },
      "Clear Libxmtp File Logs": async () => {
        Alert.alert(
          "Confirm Delete",
          "Are you sure you want to delete all XMTP log files stored on this device?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                stopXmtpFileLogging()
                clearXmtpLogFiles()
                showSnackbar({
                  message:
                    "XMTP log files cleared. Logging paused, click Start File logging to restart.",
                })
              },
            },
          ],
        )
      },
      "Clear XMTP logs": async () => {
        try {
          await clearXmtpLogs()
        } catch (error) {
          captureError(new GenericError({ error, additionalMessage: "Error clearing XMTP logs" }))
        }
      },
      "Share current XMTP logs": async () => {
        try {
          const logFilePath = await getXmtpLogFile()
          shareContent({
            title: translate("debug.xmtp_log_session"),
            url: `file://${logFilePath}`,
            type: "text/plain",
          }).catch(captureError)
        } catch (error) {
          captureError(new GenericError({ error, additionalMessage: "Error sharing XMTP logs" }))
        }
      },
      "Display current XMTP logs": async () => {
        try {
          const logFilePath = await getXmtpLogFile()
          navigate("WebviewPreview", { uri: logFilePath })
        } catch (error) {
          captureError(new GenericError({ error, additionalMessage: "Error displaying XMTP logs" }))
        }
      },
      Cancel: undefined,
    }

    const options = Object.keys(logsMethods)

    showActionSheet({
      options: {
        title: "Debug Logs",
        options,
        cancelButtonIndex: options.indexOf("Cancel"),
      },
      callback: async (selectedIndex?: number) => {
        if (selectedIndex === undefined) {
          return
        }

        const method = logsMethods[options[selectedIndex] as keyof typeof logsMethods]

        if (method) {
          try {
            await method()
          } catch (error) {
            captureError(new GenericError({ error, additionalMessage: "Error showing logs menu" }))
          }
        }
      },
    })
  }, [])

  const showNotificationsMenu = useCallback(() => {
    const notificationsMethods = {
      "Check Notification Permission Status": async () => {
        try {
          const hasPermission = await userHasGrantedNotificationsPermissions()
          const canAskAgain = await canAskForNotificationsPermissions()
          const permissionDetails = await Notifications.getPermissionsAsync()

          const permissionStatusString = (() => {
            switch (permissionDetails.status) {
              case Notifications.PermissionStatus.GRANTED:
                return "GRANTED"
              case Notifications.PermissionStatus.DENIED:
                return "DENIED"
              case Notifications.PermissionStatus.UNDETERMINED:
                return "UNDETERMINED"
              default:
                return "UNKNOWN"
            }
          })()

          const iOSStatusString = (() => {
            if (!permissionDetails.ios?.status) return "N/A"

            switch (permissionDetails.ios.status) {
              case Notifications.IosAuthorizationStatus.AUTHORIZED:
                return "AUTHORIZED"
              case Notifications.IosAuthorizationStatus.DENIED:
                return "DENIED"
              case Notifications.IosAuthorizationStatus.EPHEMERAL:
                return "EPHEMERAL"
              case Notifications.IosAuthorizationStatus.PROVISIONAL:
                return "PROVISIONAL"
              default:
                return "UNKNOWN"
            }
          })()

          Alert.alert(
            "Notification Permissions",
            [
              `Granted: ${hasPermission ? "YES" : "NO"}`,
              `Status: ${permissionStatusString}`,
              `Can Ask Again: ${canAskAgain ? "YES" : "NO"}`,
              `iOS Settings: ${iOSStatusString}`,
              Platform.OS === "ios"
                ? [
                    `Alerts: ${permissionDetails.ios?.allowsAlert ? "YES" : "NO"}`,
                    `Badges: ${permissionDetails.ios?.allowsBadge ? "YES" : "NO"}`,
                    `Sounds: ${permissionDetails.ios?.allowsSound ? "YES" : "NO"}`,
                    `Critical Alerts: ${permissionDetails.ios?.allowsCriticalAlerts ? "YES" : "NO"}`,
                    `Announcements: ${permissionDetails.ios?.allowsAnnouncements ? "YES" : "NO"}`,
                  ].join("\n")
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error checking notification permissions",
            }),
          )
          Alert.alert("Error", "Failed to check notification permissions")
        }
      },
      "Request Notification Permissions": async () => {
        try {
          const result = await requestNotificationsPermissions()

          Alert.alert("Permission Request Result", `Granted: ${result.granted ? "YES" : "NO"}`)
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error requesting notification permissions",
            }),
          )
          Alert.alert("Error", "Failed to request notification permissions")
        }
      },
      "Register Push Notifications": async () => {
        try {
          Alert.alert(
            "Register Push Notifications",
            "This will attempt to register the device for push notifications with the server. Continue?",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Register",
                onPress: async () => {
                  try {
                    await registerPushNotifications()
                    Alert.alert(
                      "Registration Complete",
                      "Push notification registration process completed successfully.",
                    )
                  } catch (error) {
                    captureError(
                      new GenericError({
                        error,
                        additionalMessage: "Error registering for push notifications",
                      }),
                    )
                    Alert.alert("Error", "Failed to register for push notifications")
                  }
                },
              },
            ],
          )
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error registering for push notifications",
            }),
          )
          Alert.alert("Error", "Failed to register for push notifications")
        }
      },
      "Get Badge Count": async () => {
        try {
          const count = await Notifications.getBadgeCountAsync()
          Alert.alert("Badge Count", `Current badge count: ${count}`, [
            {
              text: "Clear",
              onPress: async () => {
                await Notifications.setBadgeCountAsync(0)
                Alert.alert("Badge Count", "Badge count cleared")
              },
            },
            {
              text: "Increment",
              onPress: async () => {
                await Notifications.setBadgeCountAsync(count + 1)
                Alert.alert("Badge Count", `Badge count increased to ${count + 1}`)
              },
            },
            {
              text: "OK",
              style: "cancel",
            },
          ])
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error getting badge count",
            }),
          )
          Alert.alert("Error", "Failed to get badge count")
        }
      },
      "Get Device Token": async () => {
        try {
          const token = await getDevicePushNotificationsToken()
          Alert.alert("Device Token", token || "No token available", [
            {
              text: "Copy",
              onPress: () => {
                if (token) {
                  Clipboard.setString(token)
                  Alert.alert("Copied", "Device token copied to clipboard")
                }
              },
            },
            {
              text: "OK",
              style: "cancel",
            },
          ])
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error getting device token",
            }),
          )
          Alert.alert("Error", "Failed to get device token. Make sure permissions are granted.")
        }
      },
      "Notification Categories": async () => {
        try {
          const categories = await Notifications.getNotificationCategoriesAsync()
          if (categories.length === 0) {
            Alert.alert("No Categories", "No notification categories are configured")
          } else {
            const categoryDetails = categories
              .map(
                (cat) =>
                  `ID: ${cat.identifier}\nActions: ${cat.actions.map((a) => a.identifier).join(", ")}`,
              )
              .join("\n\n")

            Alert.alert("Notification Categories", categoryDetails)
          }
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error getting notification categories",
            }),
          )
          Alert.alert("Error", "Failed to get notification categories")
        }
      },
      "Send Test Notification": async () => {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Debug Test Notification",
              body: "This is a test notification from the debug menu",
              data: { type: "debug_test" },
            },
            trigger: null, // Send immediately
          })
          Alert.alert("Notification Sent", "Test notification has been scheduled")
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error sending test notification",
            }),
          )
          Alert.alert("Error", "Failed to schedule test notification")
        }
      },
      Cancel: undefined,
    }

    const options = Object.keys(notificationsMethods)

    showActionSheet({
      options: {
        title: "Notifications Debug",
        options,
        cancelButtonIndex: options.indexOf("Cancel"),
      },
      callback: async (selectedIndex?: number) => {
        if (selectedIndex === undefined) {
          return
        }

        const method =
          notificationsMethods[options[selectedIndex] as keyof typeof notificationsMethods]

        if (method) {
          try {
            await method()
          } catch (error) {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error showing notifications menu",
              }),
            )
          }
        }
      },
    })
  }, [])

  const primaryMethods = useMemo(() => {
    return {
      Logout: async () => {
        try {
          await logout({
            caller: "debug_menu",
          })
        } catch (error) {
          alert(error)
        }
      },
      "Clear React Query cache": () => {
        try {
          // Clear both in-memory cache and persisted data
          reactQueryClient.getQueryCache().clear()
          reactQueryClient.clear()
          reactQueryClient.removeQueries()
          reactQueryPersistingStorage.clearAll()

          showSnackbar({
            message: "React Query cache completely cleared",
          })
        } catch (error) {
          captureError(
            new GenericError({ error, additionalMessage: "Error clearing React Query cache" }),
          )
          alert("Error clearing React Query cache")
        }
      },
      "Clear expo image cache": async () => {
        try {
          await Image.clearDiskCache()
          await Image.clearMemoryCache()
          showSnackbar({
            message: "Expo image cache cleared",
          })
        } catch (error) {
          captureError(
            new GenericError({ error, additionalMessage: "Error clearing expo image cache" }),
          )
          alert("Error clearing expo image cache")
        }
      },
      "Show App Info": () => {
        const appVersion = Constants.expoConfig?.version
        const buildNumber =
          Platform.OS === "ios"
            ? Constants.expoConfig?.ios?.buildNumber
            : Constants.expoConfig?.android?.versionCode
        const environment = getEnv()

        Alert.alert(
          "App Information",
          [
            `Version: ${appVersion}`,
            `Build: ${buildNumber}`,
            `Environment: ${environment}`,
            `Update ID: ${currentlyRunning.updateId || "embedded"}`,
            `Created At: ${currentlyRunning.createdAt?.toLocaleString() || "N/A"}`,
            `Runtime Version: ${currentlyRunning.runtimeVersion}`,
            `Channel: ${currentlyRunning.channel || "N/A"}`,
            `Is Embedded: ${currentlyRunning.isEmbeddedLaunch}`,
            `Is Emergency Launch: ${currentlyRunning.isEmergencyLaunch}`,
            `Emergency Launch Reason: ${currentlyRunning.emergencyLaunchReason || "None"}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
      },
      "Check for OTA updates": async () => {
        try {
          const update = await Updates.checkForUpdateAsync()
          if (update.isAvailable) {
            Alert.alert(
              "Update Available",
              "Would you like to download and install the OTA update?",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Update",
                  onPress: async () => {
                    try {
                      const fetchedUpdate = await Updates.fetchUpdateAsync()
                      if (fetchedUpdate.isNew) {
                        await Updates.reloadAsync()
                      }
                    } catch (error) {
                      captureError(
                        new GenericError({
                          error,
                          additionalMessage: "Failed to fetch OTA update",
                        }),
                      )
                    }
                  },
                },
              ],
            )
          } else {
            Alert.alert("No OTA updates available", "You are running the latest version")
          }
        } catch (error) {
          Alert.alert("Error", JSON.stringify(error))
        }
      },
      "Notifications Menu": () => showNotificationsMenu(),
      "Logs Menu": () => showLogsMenu(),
      Cancel: undefined,
    }
  }, [logout, currentlyRunning, showLogsMenu, showNotificationsMenu])

  const showDebugMenu = useCallback(() => {
    const options = Object.keys(primaryMethods)

    showActionSheet({
      options: {
        title: `Convos v${config.app.version}`,
        options,
        cancelButtonIndex: options.indexOf("Cancel"),
      },
      callback: (selectedIndex?: number) => {
        if (selectedIndex === undefined) return
        const method = primaryMethods[options[selectedIndex] as keyof typeof primaryMethods]
        if (method) {
          method()
        }
      },
    })
  }, [primaryMethods])

  return showDebugMenu
}
