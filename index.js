// At the very top of index.js, before ANY other imports
import { AppState } from "react-native"
import { registerBackgroundNotificationTaskSmall } from "@/features/notifications/background-notifications-handler-small"
import { logger } from "@/utils/logger/logger"

// Check if we're running in background mode for a notification
const BACKGROUND_NOTIFICATION_TASK = "com.convos.background-notification"

;(async () => {
  // This won't completely prevent initialization, but can skip some parts
  if (AppState.currentState !== "active") {
    logger.debug("Detected background launch, minimizing initialization")
    global.__IS_BACKGROUND_NOTIFICATION = true

    // Define task with minimal dependencies
    registerBackgroundNotificationTaskSmall().catch((error) => {
      logger.error("Error registering background notification task", error)
    })

    // Still need to continue to registerRootComponent,
    // but other parts of your app can check this global
  } else {
    global.__IS_BACKGROUND_NOTIFICATION = false
  }

  // Continue with minimal imports
  const { registerRootComponent } = require("expo")
  require("./polyfills")
  const { App } = require("./App")
  registerRootComponent(App)
})()
