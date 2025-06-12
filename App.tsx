import { BottomSheetModalProvider } from "@design-system/BottomSheet/BottomSheetModalProvider"
import { useReactQueryDevTools } from "@dev-plugins/react-query"
import { ActionSheetProvider } from "@expo/react-native-action-sheet"
import * as Sentry from "@sentry/react-native"
// import { DevToolsBubble } from "react-native-react-query-devtools"
import { ActionSheet } from "@/components/action-sheet"
import { Snackbars } from "@/components/snackbar/snackbars"
import { XmtpLogFilesModal } from "@/components/xmtp-log-files-modal"
import { useIsCurrentVersionEnough } from "@/features/app-settings/hooks/use-is-current-version-enough"
import { TurnkeyProvider } from "@/features/authentication/turnkey.provider"
import { useRefreshJwtAxiosInterceptor } from "@/features/authentication/use-refresh-jwt.axios-interceptor"
import { startListeningToAuthenticationStore } from "@/features/authentication/use-start-listening-to-auth-store"
import { useCreateUserAndMissingThingsIfNoExist } from "@/features/current-user/use-create-user-and-missing-things-if-no-exist"
import { useNotificationListeners } from "@/features/notifications/notifications-listeners"
import { useStartListeningForNotificationsPermissionsQuery } from "@/features/notifications/notifications-permissions.query"
import { useCoinbaseWalletListener } from "@/features/wallets/utils/coinbase-wallet"
import { AppNavigator } from "@/navigation/app-navigator"
import { startListeningToAppStateStore } from "@/stores/app-state-store/app-state-store.service"
import { $globalStyles } from "@/theme/styles"
import { useCachedResources } from "@/utils/cache-resources"
import { setupConvosApi } from "@/utils/convos-api/convos-api-init"
import { ReactQueryProvider } from "@/utils/react-query/react-query-provider"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { useReactQueryInit } from "@/utils/react-query/react-query.init"
import "expo-dev-client"
import React, { memo } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { ThirdwebProvider } from "thirdweb/react"
import { useMonitorNetworkConnectivity } from "./dependencies/NetworkMonitor/use-monitor-network-connectivity"
import { useStartListeningForAllowedConsentConversations } from "./features/conversation/conversation-list/use-start-listening-for-allowed-consent-conversations"
import { useStartListeningToCurrentUserQuery } from "./features/current-user/use-start-listening-to-current-user-query"
import { configureForegroundNotificationBehavior } from "./features/notifications/notifications-init"
import "./utils/ignore-logs"
import { FullScreenLoader } from "@/components/full-screen-loader"
import { FullScreenOverlay } from "@/components/full-screen-overlay"
import { defineBackgroundSyncTask } from "@/features/background-sync/background-sync"
import { sentryInit } from "./utils/sentry/sentry-init"
import { preventSplashScreenAutoHide } from "./utils/splash/splash"

preventSplashScreenAutoHide()
sentryInit()
configureForegroundNotificationBehavior()
setupConvosApi()
startListeningToAppStateStore()
startListeningToAuthenticationStore()
defineBackgroundSyncTask()

export const App = Sentry.wrap(function App() {
  useMonitorNetworkConnectivity()
  useReactQueryDevTools(reactQueryClient)
  useCachedResources()
  useCoinbaseWalletListener()

  // Seems to be slowing the app. Need to investigate
  // useSyncQueries({ queryClient: reactQueryClient })

  return (
    <ReactQueryProvider>
      <TurnkeyProvider>
        <ThirdwebProvider>
          <SafeAreaProvider>
            <KeyboardProvider>
              <ActionSheetProvider>
                <GestureHandlerRootView style={$globalStyles.flex1}>
                  <BottomSheetModalProvider>
                    <AppNavigator />
                    {/* {__DEV__ && <DevToolsBubble />} */}
                    <FullScreenLoader />
                    <FullScreenOverlay />
                    <Handlers />
                    <Snackbars />
                    <ActionSheet />
                    <XmtpLogFilesModal />
                  </BottomSheetModalProvider>
                </GestureHandlerRootView>
              </ActionSheetProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </ThirdwebProvider>
      </TurnkeyProvider>
    </ReactQueryProvider>
  )
})

const Handlers = memo(function Handlers() {
  useIsCurrentVersionEnough()
  useRefreshJwtAxiosInterceptor()
  useCreateUserAndMissingThingsIfNoExist()
  useNotificationListeners()
  useReactQueryInit()
  useStartListeningForNotificationsPermissionsQuery()
  useStartListeningForAllowedConsentConversations()
  useStartListeningToCurrentUserQuery()

  return null
})

const test = ""
