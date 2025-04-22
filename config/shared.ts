import Constants from "expo-constants"
import { Platform } from "react-native"
import { IExpoAppConfigExtra } from "@/app.config"
import { IConfig, ILoggerColorScheme } from "@/config/config.types"
import { IXmtpEnv } from "@/features/xmtp/xmtp.types"
import { LogLevel } from "@/utils/logger/logger.types"

function maybeReplaceLocalhost(uri: string) {
  try {
    if (uri?.includes("localhost")) {
      // Try Expo host info first
      const hostIp = Constants.expoConfig?.hostUri?.split(":")[0]

      if (!hostIp) {
        throw new Error("No expo host IP found")
      }

      const newUri = uri.replace("localhost", hostIp)

      return newUri
    }
  } catch (error) {
    console.error(error)
  }

  return uri
}

const appConfigExtra = Constants.expoConfig?.extra as IExpoAppConfigExtra

// Base configuration shared across all environments
export const shared = {
  debugMenu: true,
  loggerColorScheme: (process.env.EXPO_PUBLIC_LOGGER_COLOR_SCHEME as ILoggerColorScheme) || "light",
  loggerLevel: (process.env.EXPO_PUBLIC_LOGGER_LEVEL as LogLevel) || "debug",
  reactQueryPersistCacheIsEnabled:
    process.env.EXPO_PUBLIC_ENABLE_REACT_QUERY_PERSIST_CACHE !== "false",
  debugEthAddresses: process.env.EXPO_PUBLIC_DEBUG_ETH_ADDRESSES?.split(",") || [],
  app: {
    scheme: Constants.expoConfig?.scheme as string,
    name: Constants.expoConfig?.name as string,
    version: Constants.expoConfig?.version as string,
    storeUrl: "",
    bundleId:
      Platform.OS === "android"
        ? (Constants.expoConfig?.android?.package as string)
        : (Constants.expoConfig?.ios?.bundleIdentifier as string),
    universalLinks: [appConfigExtra.webDomain].flatMap((domain) => [
      `https://${domain}`,
      `http://${domain}`,
      domain,
    ]),
    apiUrl: maybeReplaceLocalhost(process.env.EXPO_PUBLIC_CONVOS_API_URI),
    webDomain: appConfigExtra.webDomain,
  },
  expo: {
    projectId: appConfigExtra.eas.projectId,
  },
  firebase: {
    appCheckDebugToken:
      Platform.OS === "android"
        ? process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID
        : process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS,
  },
  sentry: {
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
  thirdweb: {
    clientId: process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID,
  },
  privy: {
    appId: process.env.EXPO_PUBLIC_PRIVY_APP_ID,
    clientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,
  },
  evm: {
    rpcEndpoint: process.env.EXPO_PUBLIC_EVM_RPC_ENDPOINT,
  },
  xmtp: {
    env: (process.env.EXPO_PUBLIC_XMTP_ENV || "local") as IXmtpEnv,
    maxMsUntilLogError: 5000,
  },
} as const satisfies Partial<IConfig>
