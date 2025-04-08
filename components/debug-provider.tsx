import Clipboard from "@react-native-clipboard/clipboard"
import Constants from "expo-constants"
import { Image } from "expo-image"
import * as Notifications from "expo-notifications"
import * as Updates from "expo-updates"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { Alert, Platform } from "react-native"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { config } from "@/config"
import { VStack } from "@/design-system/VStack"
import { useLogout } from "@/features/authentication/use-logout"
import {
  canAskForNotificationsPermissions,
  getDevicePushNotificationsToken,
  registerPushNotifications,
  requestNotificationsPermissions,
  userHasGrantedNotificationsPermissions,
} from "@/features/notifications/notifications.service"
import { useStreamingStore } from "@/features/streams/stream-store"
import { clearXmtpLogs, getXmtpLogFile } from "@/features/xmtp/xmtp-logs"
import { translate } from "@/i18n"
import { navigate } from "@/navigation/navigation.utils"
import { $globalStyles } from "@/theme/styles"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { getEnv } from "@/utils/getEnv"
import { clearLogFile, LOG_FILE_PATH } from "@/utils/logger/logger"
import { ObjectTyped } from "@/utils/object-typed"
import { shareContent } from "@/utils/share"
import { showActionSheet } from "./action-sheet"

export function DebugProvider(props: { children: React.ReactNode }) {
  const { children } = props

  const tapCountRef = useRef(0)
  const tapTimeoutRef = useRef<NodeJS.Timeout>()
  const showDebugMenu = useShowDebugMenu()

  const handleTouchStart = useCallback(() => {
    // Increment tap count
    tapCountRef.current += 1

    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
    }

    // Set new timeout to reset count after 200ms
    tapTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0
    }, 200)

    // Show debug menu after 6 taps
    if (tapCountRef.current >= 6) {
      showDebugMenu()
      tapCountRef.current = 0
    }
  }, [showDebugMenu])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current)
      }
    }
  }, [])

  return (
    <VStack onTouchStart={handleTouchStart} style={$globalStyles.flex1}>
      {children}
    </VStack>
  )
}

function useShowDebugMenu() {
  const { logout } = useLogout()

  const { currentlyRunning } = Updates.useUpdates()

  const showLogsMenu = useCallback(() => {
    const logsMethods = {
      "Start new log session": () => {
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
      "-": () => Promise.resolve(), // Separator
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
      "Show Streaming Status": () => {
        const { accountStreamingStates } = useStreamingStore.getState()
        const accounts = ObjectTyped.keys(accountStreamingStates)

        if (accounts.length === 0) {
          Alert.alert("No Streaming States", "No accounts are currently streaming")
          return
        }

        const statusMessages = accounts.map((inboxId) => {
          const state = accountStreamingStates[inboxId]
          return [
            `InboxId: ${inboxId}`,
            `Conversations Streaming: ${state.isStreamingConversations ? "ON" : "OFF"}`,
            `Messages Streaming: ${state.isStreamingMessages ? "ON" : "OFF"}`,
            `Consent Streaming: ${state.isStreamingConsent ? "ON" : "OFF"}`,
            "---",
          ].join("\n")
        })

        Alert.alert("Streaming Status", statusMessages.join("\n"))
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
