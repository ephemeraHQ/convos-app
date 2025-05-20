import type { IXmtpEnv } from "@/features/xmtp/xmtp.types"
import { LogLevel } from "@/utils/logger/logger.types"

export type ILoggerColorScheme = "light" | "dark"

export type IConfig = {
  loggerColorScheme: ILoggerColorScheme
  loggerLevel: LogLevel
  reactQueryPersistCacheIsEnabled: boolean
  debugMenu: boolean
  debugEthAddresses: string[]
  app: {
    name: string
    version: string
    storeUrl: string
    buildNumber: number
    bundleId: string
    scheme: string
    universalLinks: string[]
    apiUrl: string
    webDomain: string
  }
  ios: {
    appGroupId: string
  }
  expo: {
    projectId: string
  }
  firebase: {
    appCheckDebugToken: string
  }
  sentry: {
    dsn: string
  }
  thirdweb: {
    clientId: string
  }
  turnkey: {
    organizationId: string
    turnkeyApiUrl: string
  }
  evm: {
    rpcEndpoint: string
  }
  xmtp: {
    env: IXmtpEnv
    maxMsUntilLogError: number
  }
}
