import { BottomSheetModalProvider } from "@design-system/BottomSheet/BottomSheetModalProvider"
import { useReactQueryDevTools } from "@dev-plugins/react-query"
import { ActionSheetProvider } from "@expo/react-native-action-sheet"
// import { DevToolsBubble } from "react-native-react-query-devtools"
import { ActionSheet } from "@/components/action-sheet"
import { Snackbars } from "@/components/snackbar/snackbars"
import { XmtpLogFilesModal } from "@/components/xmtp-log-files-modal"
import { useIsCurrentVersionEnough } from "@/features/app-settings/hooks/use-is-current-version-enough"
import { TurnkeyProvider } from "@/features/authentication/turnkey.provider"
import { useRefreshJwtAxiosInterceptor } from "@/features/authentication/use-refresh-jwt.axios-interceptor"
import { useCreateUserIfNoExist } from "@/features/current-user/use-create-user-if-no-exist"
import { useRegisterBackgroundNotificationTask } from "@/features/notifications/background-notifications-handler"
import { unregisterBackgroundNotificationTaskSmall } from "@/features/notifications/background-notifications-handler-small"
import { useConversationsNotificationsSubscriptions } from "@/features/notifications/notifications-conversations-subscriptions"
import { useNotificationListeners } from "@/features/notifications/notifications-listeners"
import { useSetupStreamingSubscriptions } from "@/features/streams/streams"
import { useCoinbaseWalletListener } from "@/features/wallets/utils/coinbase-wallet"
import { AppNavigator } from "@/navigation/app-navigator"
import { useAppLaunchedForBackgroundStuff } from "@/stores/use-app-state-store"
import { $globalStyles } from "@/theme/styles"
import { useCachedResources } from "@/utils/cache-resources"
import { captureError } from "@/utils/capture-error"
import { setupConvosApi } from "@/utils/convos-api/convos-api-init"
import { ReactQueryProvider } from "@/utils/react-query/react-query-provider"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { useReactQueryInit } from "@/utils/react-query/react-query.init"
import "expo-dev-client"
import React, { memo, useEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { ThirdwebProvider } from "thirdweb/react"
import { useMonitorNetworkConnectivity } from "./dependencies/NetworkMonitor/use-monitor-network-connectivity"
import { configureForegroundNotificationBehavior } from "./features/notifications/notifications-init"
import "./utils/ignore-logs"
import { sentryInit } from "./utils/sentry/sentry-init"
import { preventSplashScreenAutoHide } from "./utils/splash/splash"

preventSplashScreenAutoHide()
sentryInit()
configureForegroundNotificationBehavior()

export function App() {
  return <Main />
}

const Main = memo(function Main() {
  useRegisterBackgroundNotificationTask()

  // Keep temporary
  useEffect(() => {
    unregisterBackgroundNotificationTaskSmall().catch(captureError)
  }, [])

  const isLaunchedForBackgroundStuff = useAppLaunchedForBackgroundStuff()

  if (isLaunchedForBackgroundStuff) {
    return null
  }

  return <Content />
})

function Content() {
  useMonitorNetworkConnectivity()
  useReactQueryDevTools(reactQueryClient)
  useSetupStreamingSubscriptions()
  useCachedResources()
  useCoinbaseWalletListener()

  useEffect(() => {
    setupConvosApi()
  }, [])

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
}

const Handlers = memo(function Handlers() {
  useIsCurrentVersionEnough()
  useRefreshJwtAxiosInterceptor()
  useCreateUserIfNoExist()
  useNotificationListeners()
  useConversationsNotificationsSubscriptions()
  useReactQueryInit()

  return null
})
