import { BottomSheetModalProvider } from "@design-system/BottomSheet/BottomSheetModalProvider"
import { useReactQueryDevTools } from "@dev-plugins/react-query"
import { ActionSheetProvider } from "@expo/react-native-action-sheet"
import { addRpcUrlOverrideToChain } from "@privy-io/chains"
import { Chain, PrivyProvider } from "@privy-io/expo"
import { SmartWalletsProvider } from "@privy-io/expo/smart-wallets"
import { ActionSheet } from "@/components/action-sheet"
import { ConditionalWrapper } from "@/components/conditional-wrapper"
import { DebugProvider } from "@/components/debug-provider"
import { Snackbars } from "@/components/snackbar/snackbars"
import { useIsCurrentVersionEnough } from "@/features/app-settings/hooks/use-is-current-version-enough"
import { useSignoutIfNoPrivyUser } from "@/features/authentication/use-logout-if-no-privy-user"
import { useRefreshJwtAxiosInterceptor } from "@/features/authentication/use-refresh-jwt.axios-interceptor"
import { useCreateUserIfNoExist } from "@/features/current-user/use-create-user-if-no-exist"
import { useNotificationListeners } from "@/features/notifications/notifications-listeners"
import { useSetupStreamingSubscriptions } from "@/features/streams/streams"
import { useCoinbaseWalletListener } from "@/features/wallets/utils/coinbase-wallet"
import { AppNavigator } from "@/navigation/app-navigator"
import { $globalStyles } from "@/theme/styles"
import { useCachedResources } from "@/utils/cache-resources"
import { captureError } from "@/utils/capture-error"
import { setupConvosApi } from "@/utils/convos-api/convos-api-init"
import { ReactQueryPersistProvider } from "@/utils/react-query/react-query-persist-provider"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import "expo-dev-client"
import React, { memo, useEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { ThirdwebProvider } from "thirdweb/react"
import { base } from "viem/chains"
import { config } from "./config"
import { useMonitorNetworkConnectivity } from "./dependencies/NetworkMonitor/use-monitor-network-connectivity"
import { registerBackgroundNotificationTask } from "./features/notifications/background-notifications-handler"
import { setupConversationsNotificationsSubscriptions } from "./features/notifications/notifications-conversations-subscriptions"
import { configureForegroundNotificationBehavior } from "./features/notifications/notifications-init"
import "./utils/ignore-logs"
import { sentryInit } from "./utils/sentry/sentry-init"
import { preventSplashScreenAutoHide } from "./utils/splash/splash"

preventSplashScreenAutoHide()

const chainOverride = addRpcUrlOverrideToChain(base, config.evm.rpcEndpoint)
const supportedChains = [chainOverride] as [Chain, ...Chain[]]

export function App() {
  useMonitorNetworkConnectivity()
  useReactQueryDevTools(reactQueryClient)
  useSetupStreamingSubscriptions()
  useCachedResources()
  useCoinbaseWalletListener()

  useEffect(() => {
    sentryInit()
    setupConvosApi()
    configureForegroundNotificationBehavior()
    setupConversationsNotificationsSubscriptions().catch(captureError)
    registerBackgroundNotificationTask().catch(captureError)
  }, [])

  // Seems to be slowing the app. Need to investigate
  // useSyncQueries({ queryClient: reactQueryClient })

  return (
    <ReactQueryPersistProvider>
      <PrivyProvider
        appId={config.privy.appId}
        clientId={config.privy.clientId}
        supportedChains={supportedChains}
      >
        <SmartWalletsProvider>
          <ThirdwebProvider>
            <SafeAreaProvider>
              <KeyboardProvider>
                <ActionSheetProvider>
                  <GestureHandlerRootView style={$globalStyles.flex1}>
                    <ConditionalWrapper
                      condition={config.debugMenu}
                      wrapper={(children) => <DebugProvider>{children}</DebugProvider>}
                    >
                      <BottomSheetModalProvider>
                        <AppNavigator />
                        {/* {__DEV__ && <DevToolsBubble />} */}
                        <Handlers />
                        <Snackbars />
                        <ActionSheet />
                      </BottomSheetModalProvider>
                    </ConditionalWrapper>
                  </GestureHandlerRootView>
                </ActionSheetProvider>
              </KeyboardProvider>
            </SafeAreaProvider>
          </ThirdwebProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </ReactQueryPersistProvider>
  )
}

const Handlers = memo(function Handlers() {
  useIsCurrentVersionEnough()
  useRefreshJwtAxiosInterceptor()
  useSignoutIfNoPrivyUser()
  useCreateUserIfNoExist()
  useNotificationListeners()

  return null
})
