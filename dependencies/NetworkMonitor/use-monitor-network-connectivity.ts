import NetInfo from "@react-native-community/netinfo"
import { useEffect } from "react"
import { logger } from "@/utils/logger/logger"
import { config } from "../../config"
import { useAppStore } from "../../stores/app-store"

NetInfo.configure({
  reachabilityUrl: `${config.app.apiUrl}/healthcheck`,
  reachabilityMethod: "HEAD",
  reachabilityTest: async (response) => response.status === 200,
})

export function useMonitorNetworkConnectivity() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      const reachable = !!netState.isInternetReachable
      const currentReachable = useAppStore.getState().isInternetReachable

      if (reachable !== currentReachable) {
        logger.debug(`Internet reachable: ${reachable}`)
        useAppStore.getState().setIsInternetReachable(reachable)
      }
    })

    return unsubscribe
  }, [])
}
