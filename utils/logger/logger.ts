import * as Sentry from "@sentry/react-native"
import * as FileSystem from "expo-file-system"
import {
  consoleTransport,
  fileAsyncTransport,
  logger as RNLogger,
  transportFunctionType,
} from "react-native-logs"
import { config } from "@/config"
import { LOG_LEVELS } from "@/utils/logger/logger.types"

const colorsSchemes = {
  dark: {
    debug: "white",
    info: "blueBright",
    warn: "yellowBright",
    error: "redBright",
  },
  light: {
    debug: "black",
    info: "blue",
    warn: "yellow",
    error: "red",
  },
} as const

const activeColorScheme =
  config.loggerColorScheme === "dark" ? colorsSchemes.dark : colorsSchemes.light

// Custom transport that only adds breadcrumbs to Sentry
const breadcrumbTransport: transportFunctionType<{}> = (args) => {
  const { msg, level } = args
  Sentry.addBreadcrumb({
    category: "log",
    message: msg,
    level: level.text as Sentry.SeverityLevel,
    timestamp: Date.now(),
  })
}

const LOG_FILE_NAME = "convos-logs.txt"
const LOG_FILE_DIR = FileSystem.documentDirectory!
export const LOG_FILE_PATH = `${LOG_FILE_DIR}${LOG_FILE_NAME}`
const MAX_LOG_SIZE = 512 * 1024 // 0.5MB

export async function clearLogFile() {
  await FileSystem.writeAsStringAsync(LOG_FILE_PATH, "")
}

// Check log file size and reset if needed
export async function checkLogFileSize() {
  try {
    const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH)

    if (!fileInfo.exists) {
      return
    }

    if (fileInfo.size > MAX_LOG_SIZE) {
      // Just clear the file when it gets too big
      await clearLogFile()
    }
  } catch (error) {
    console.error("Failed to check log file size:", error)
  }
}

const transports = [
  // In dev: use both console and file logging for testing
  ...(__DEV__ ? [consoleTransport, fileAsyncTransport] : []),
  // In prod: only file logging
  ...(!__DEV__ ? [fileAsyncTransport] : []),
  // Always add breadcrumbs to Sentry
  breadcrumbTransport,
]

const baseLogger = RNLogger.createLogger({
  severity: config.loggerLevel,
  levels: LOG_LEVELS,
  printLevel: !__DEV__, // Too verbose in dev but useful for other environments
  printDate: !__DEV__, // Too verbose in dev but useful for other environments
  ...(!__DEV__ && {
    dateFormat: (date) => {
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} `
    },
  }),
  enabled: true,
  transport: transports,
  transportOptions: {
    colors: activeColorScheme,
    fileName: LOG_FILE_NAME,
    filePath: LOG_FILE_DIR,
    FS: {
      documentDirectory: FileSystem.documentDirectory,
      DocumentDirectoryPath: null as never,
      writeAsStringAsync: FileSystem.writeAsStringAsync,
      readAsStringAsync: FileSystem.readAsStringAsync,
      getInfoAsync: FileSystem.getInfoAsync,
      appendFile: undefined,
    },
  },
})

// Initial check
checkLogFileSize().catch(console.error)

// Periodic checks
setInterval(() => {
  checkLogFileSize().catch(console.error)
}, 20000)

// Logger exports
export const logger = baseLogger.extend("GENERAL")
export const authLogger = baseLogger.extend("AUTH")
export const streamLogger = baseLogger.extend("STREAM")
export const apiLogger = baseLogger.extend("API")
export const xmtpLogger = baseLogger.extend("XMTP")
export const notificationsLogger = baseLogger.extend("NOTIFICATIONS")
export const sentryLogger = baseLogger.extend("SENTRY")
export const persistLogger = baseLogger.extend("PERSIST")
export const queryLogger = baseLogger.extend("QUERY")
export const deepLinkLogger = baseLogger.extend("DEEPLINK")
export const navigationLogger = baseLogger.extend("NAVIGATION")
export const appStateLogger = baseLogger.extend("APP_STATE")
export const backgroundTaskLogger = baseLogger.extend("BACKGROUND_TASK")
export const renderLogger = baseLogger.extend("RENDER")

// Pretty print JSON for terminal output
export function logJson(label: string, json: any) {
  console.log(`${label}:`, JSON.stringify(json, null, 2))
}
