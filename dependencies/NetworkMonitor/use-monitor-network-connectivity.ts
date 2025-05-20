import NetInfo from "@react-native-community/netinfo"
import { useEffect } from "react"
import { logger } from "@/utils/logger/logger"
import { config } from "../../config"
import { useAppStore } from "../../stores/app.store"

NetInfo.configure({
  reachabilityUrl: `${config.app.apiUrl}/healthcheck`, // We assume our BE is always reachable
  reachabilityMethod: "HEAD",
  reachabilityTest: async (response) => response.status === 200,
})

export function useMonitorNetworkConnectivity() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      const reachable = !!netState.isInternetReachable

      logger.debug(`Internet connectivity is ${reachable ? "reachable" : "not reachable"}`)

      useAppStore.getState().actions.setIsInternetReachable(reachable)
    })

    return unsubscribe
  }, [])
}
