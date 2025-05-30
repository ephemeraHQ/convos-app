import Clipboard from "@react-native-clipboard/clipboard"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import * as Updates from "expo-updates"
import { memo, useCallback, useMemo } from "react"
import { Alert, Platform } from "react-native"
import RNFS from "react-native-fs"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { runOnJS } from "react-native-reanimated"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { useXmtpLogFilesModalStore } from "@/components/xmtp-log-files-modal"
import { config } from "@/config"
import { getSafeCurrentSender, useCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { currentUserIsDebugUser } from "@/features/authentication/utils/debug-user.utils"
import {
  canAskForNotificationsPermissions,
  requestNotificationsPermissions,
  userHasGrantedNotificationsPermissions,
} from "@/features/notifications/notifications-permissions"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { getDevicePushNotificationsToken } from "@/features/notifications/notifications-token"
import { getXmtpDbEncryptionKey } from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key"
import { getXmtpDbDirectory } from "@/features/xmtp/xmtp-client/xmtp-client-utils"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { getXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-list"
import { syncAllXmtpConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import {
  clearXmtpLogFiles,
  clearXmtpLogs,
  getXmtpLogFile,
  startXmtpFileLogging,
  stopXmtpFileLogging,
} from "@/features/xmtp/xmtp-logs"
import type { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { translate } from "@/i18n"
import { navigate } from "@/navigation/navigation.utils"
import { useAppStore } from "@/stores/app.store"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { lowercaseEthAddress } from "@/utils/evm/address"
import { getEnv, isProd } from "@/utils/getEnv"
import { Haptics } from "@/utils/haptics"
import { clearImageCache } from "@/utils/image"
import { clearLogFile, LOG_FILE_PATH } from "@/utils/logger/logger"
import { clearReacyQueryQueriesAndCache } from "@/utils/react-query/react-query.utils"
import { shareContent } from "@/utils/share"
import { showActionSheet } from "./action-sheet"

export const DebugMenuWrapper = memo(function DebugWrapper(props: { children: React.ReactNode }) {
  const { children } = props

  // Check if debug menu should be available:
  // - In production: only for debug users
  // - In development/preview: for all users
  const isDebugUser = !isProd || currentUserIsDebugUser()

  const showDebugMenu = useShowDebugMenu()

  const longPressGesture = Gesture.LongPress()
    .onStart(() => {
      Haptics.softImpactAsyncAnimated()
      runOnJS(showDebugMenu)()
    })
    .minDuration(600)

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
  const currentSenderInboxId = useCurrentSender()?.inboxId

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
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error checking notification permissions",
            }),
            { message: "Failed to check notification permissions" },
          )
        }
      },
      "Request Notification Permissions": async () => {
        try {
          const result = await requestNotificationsPermissions()

          Alert.alert("Permission Request Result", `Granted: ${result.granted ? "YES" : "NO"}`)
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error requesting notification permissions",
            }),
            { message: "Failed to request notification permissions" },
          )
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
                    captureErrorWithToast(
                      new GenericError({
                        error,
                        additionalMessage: "Error registering for push notifications",
                      }),
                      { message: "Failed to register for push notifications" },
                    )
                  }
                },
              },
            ],
          )
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error registering for push notifications",
            }),
            { message: "Failed to register for push notifications" },
          )
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
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error getting badge count",
            }),
            { message: "Failed to get badge count" },
          )
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
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error getting device token",
            }),
            { message: "Failed to get device token. Make sure permissions are granted." },
          )
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
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error getting notification categories",
            }),
            { message: "Failed to get notification categories" },
          )
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
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error sending test notification",
            }),
            { message: "Failed to schedule test notification" },
          )
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

  const showXmtpMenu = useCallback(() => {
    if (!currentSenderInboxId) {
      captureErrorWithToast(
        new GenericError({
          error: new Error("Current user XMTP Inbox ID not found"),
          additionalMessage: "Current user XMTP Inbox ID not found",
        }),
        { message: "Current user XMTP Inbox ID not found" },
      )
      return
    }
    const clientInboxId = currentSenderInboxId as IXmtpInboxId

    const xmtpMethods = {
      "List Allowed XMTP Conversations": async () => {
        try {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: true,
            texts: ["Loading XMTP conversations..."],
          })

          await syncAllXmtpConversations({
            clientInboxId,
            caller: "debugMenuListAllowed",
          })
          const conversations = await getXmtpConversations({
            clientInboxId,
            consentStates: ["allowed"],
            caller: "debugMenu",
          })
          if (conversations.length === 0) {
            Alert.alert("XMTP Conversations", "No allowed conversations found.")
            return
          }
          const conversationIds = conversations
            .map((conv) => getXmtpConversationIdFromXmtpTopic(conv.topic))
            .join(",")
          Alert.alert(`Allowed XMTP Conversation IDs (${conversations.length})`, conversationIds, [
            { text: "OK" },
            {
              text: "Copy IDs",
              onPress: () => Clipboard.setString(conversationIds),
            },
          ])
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error listing allowed XMTP conversations",
            }),
            { message: "Failed to list allowed XMTP conversations" },
          )
        } finally {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: false,
          })
        }
      },
      "List Denied XMTP Conversations": async () => {
        try {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: true,
            texts: ["Loading XMTP conversations..."],
          })

          await syncAllXmtpConversations({
            clientInboxId,
            caller: "debugMenuListDenied",
          })
          const conversations = await getXmtpConversations({
            clientInboxId,
            consentStates: ["denied"],
            caller: "debugMenu",
          })
          if (conversations.length === 0) {
            Alert.alert("XMTP Conversations", "No denied conversations found.")
            return
          }
          const conversationIds = conversations
            .map((conv) => getXmtpConversationIdFromXmtpTopic(conv.topic))
            .join(",")
          Alert.alert(`Denied XMTP Conversation IDs (${conversations.length})`, conversationIds, [
            { text: "OK" },
            {
              text: "Copy IDs",
              onPress: () => Clipboard.setString(conversationIds),
            },
          ])
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error listing denied XMTP conversations",
            }),
            { message: "Failed to list denied XMTP conversations" },
          )
        } finally {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: false,
          })
        }
      },
      "List Unknown XMTP Conversations": async () => {
        try {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: true,
            texts: ["Loading XMTP conversations..."],
          })

          await syncAllXmtpConversations({
            clientInboxId,
            caller: "debugMenuListUnknown",
          })
          const conversations = await getXmtpConversations({
            clientInboxId,
            consentStates: ["unknown"],
            caller: "debugMenu",
          })
          if (conversations.length === 0) {
            Alert.alert("XMTP Conversations", "No unknown conversations found.")
            return
          }
          const conversationIds = conversations
            .map((conv) => getXmtpConversationIdFromXmtpTopic(conv.topic))
            .join(",")
          Alert.alert(`Unknown XMTP Conversation IDs (${conversations.length})`, conversationIds, [
            { text: "OK" },
            {
              text: "Copy IDs",
              onPress: () => Clipboard.setString(conversationIds),
            },
          ])
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error listing unknown XMTP conversations",
            }),
            { message: "Failed to list unknown XMTP conversations" },
          )
        } finally {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: false,
          })
        }
      },
      "Export DB Encryption Key": async () => {
        try {
          const currentSender = getSafeCurrentSender()
          const ethAddress = lowercaseEthAddress(currentSender.ethereumAddress)

          const encryptionKey = await getXmtpDbEncryptionKey({ ethAddress })

          if (!encryptionKey) {
            captureErrorWithToast(
              new GenericError({
                error: new Error("No DB encryption key found"),
                additionalMessage: "No DB encryption key found",
              }),
              { message: "No DB encryption key found" },
            )
            return
          }

          Alert.alert("XMTP DB Encryption Key", encryptionKey, [
            { text: "Close" },
            {
              text: "Copy",
              onPress: () => {
                Clipboard.setString(encryptionKey)
                Alert.alert("Copied", "Encryption key copied to clipboard")
              },
            },
          ])
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error exporting DB encryption key",
            }),
            { message: "Failed to export DB encryption key" },
          )
        }
      },
      "Export user database files": async () => {
        try {
          const dbDirectory = await getXmtpDbDirectory()

          if (!dbDirectory) {
            captureErrorWithToast(
              new GenericError({
                error: new Error("Could not get shared app group directory"),
                additionalMessage: "Could not get shared app group directory (iOS only feature)",
              }),
              { message: "Could not get shared app group directory (iOS only feature)" },
            )
            return
          }

          const files = await RNFS.readDir(dbDirectory)

          // Filter for main database files (.db3) that contain the current user's inbox ID
          const userDbFiles = files.filter(
            (file) =>
              file.isFile() && file.name.includes(clientInboxId) && file.name.endsWith(".db3"),
          )

          if (userDbFiles.length === 0) {
            Alert.alert(
              "No Database Files",
              `No database files found for current user (${clientInboxId}).`,
            )
            return
          }

          // Create options for each database file
          const fileOptions = userDbFiles.map((file) => {
            const sizeKB = Math.round(file.size / 1024)
            // Extract environment from filename (dev/production)
            const envMatch = file.name.match(/xmtp-grpc\.(dev|production)\./)
            const env = envMatch ? envMatch[1] : "unknown"
            return `${env.toUpperCase()}: ${file.name} (${sizeKB}KB)`
          })

          fileOptions.push("Cancel")

          showActionSheet({
            options: {
              title: `Export Database Files (${userDbFiles.length} files)`,
              options: fileOptions,
              cancelButtonIndex: fileOptions.indexOf("Cancel"),
            },
            callback: async (selectedIndex?: number) => {
              if (selectedIndex === undefined || selectedIndex >= userDbFiles.length) {
                return
              }

              const selectedFile = userDbFiles[selectedIndex]
              const filePath = `${dbDirectory}/${selectedFile.name}`

              try {
                await shareContent({
                  title: `XMTP Database: ${selectedFile.name}`,
                  url: `file://${filePath}`,
                  type: "application/octet-stream",
                })
              } catch (error) {
                captureErrorWithToast(
                  new GenericError({
                    error,
                    additionalMessage: "Error sharing database file",
                  }),
                  { message: "Failed to share database file" },
                )
              }
            },
          })
        } catch (error) {
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error exporting user database files",
            }),
            { message: "Failed to export database files" },
          )
        }
      },
      Cancel: undefined,
    }

    const options = Object.keys(xmtpMethods)
    showActionSheet({
      options: {
        title: "XMTP Debug",
        options,
        cancelButtonIndex: options.indexOf("Cancel"),
      },
      callback: async (selectedIndex?: number) => {
        if (selectedIndex === undefined) {
          return
        }
        const method = xmtpMethods[options[selectedIndex] as keyof typeof xmtpMethods]
        if (method) {
          try {
            await method()
          } catch (error) {
            captureError(new GenericError({ error, additionalMessage: "Error in XMTP menu" }))
          }
        }
      },
    })
  }, [currentSenderInboxId])

  const showCacheMenu = useCallback(() => {
    const cacheMethods = {
      "Clear React Query cache": async () => {
        try {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: true,
            texts: ["Clearing React Query cache..."],
          })
          clearReacyQueryQueriesAndCache()
          // Give some time for the cache to clear before reloading
          await new Promise((resolve) => setTimeout(resolve, 500))
          await Updates.reloadAsync()
        } catch (error) {
          captureErrorWithToast(
            new GenericError({ error, additionalMessage: "Error clearing React Query cache" }),
            { message: "Failed to clear React Query cache" },
          )
        } finally {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: false,
          })
        }
      },
      "Clear expo image cache": async () => {
        try {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: true,
            texts: ["Clearing Expo Image cache..."],
          })
          await clearImageCache()
          showSnackbar({
            message: "Expo image cache cleared",
          })
        } catch (error) {
          captureErrorWithToast(
            new GenericError({ error, additionalMessage: "Error clearing expo image cache" }),
            { message: "Failed to clear expo image cache" },
          )
        } finally {
          useAppStore.getState().actions.setFullScreenLoaderOptions({
            isVisible: false,
          })
        }
      },
      Cancel: undefined,
    }

    const options = Object.keys(cacheMethods)
    showActionSheet({
      options: {
        title: "Cache Management",
        options,
        cancelButtonIndex: options.indexOf("Cancel"),
      },
      callback: async (selectedIndex?: number) => {
        if (selectedIndex === undefined) {
          return
        }
        const method = cacheMethods[options[selectedIndex] as keyof typeof cacheMethods]
        if (method) {
          try {
            await method()
          } catch (error) {
            captureError(new GenericError({ error, additionalMessage: "Error in Cache menu" }))
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
          // Cast to alert as it's not necessarily an Error type
          Alert.alert("Logout Error", String(error))
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
          captureErrorWithToast(
            new GenericError({
              error,
              additionalMessage: "Error checking for OTA updates",
            }),
            { message: "Failed to check for updates" },
          )
        }
      },
      "Cache Menu": () => showCacheMenu(),
      "Notifications Menu": () => showNotificationsMenu(),
      "Logs Menu": () => showLogsMenu(),
      "XMTP Menu": () => showXmtpMenu(),
      Cancel: undefined,
    }
  }, [logout, currentlyRunning, showLogsMenu, showNotificationsMenu, showXmtpMenu, showCacheMenu])

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
