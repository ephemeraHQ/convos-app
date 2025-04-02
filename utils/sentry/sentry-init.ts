import * as Sentry from "@sentry/react-native"
import type { ErrorEvent, EventHint } from "@sentry/types"
import * as Updates from "expo-updates"
import { config } from "@/config"
import { getEnv } from "@/utils/getEnv"

export function sentryInit() {
  Sentry.init({
    dsn: config.sentry.dsn,
    debug: false,
    enabled: !__DEV__,
    environment: getEnv(),
    // Add more context data to events (IP address, cookies, user, etc.)
    sendDefaultPii: getEnv() !== "production",
    // Attach stacktraces to all messages for more context
    attachStacktrace: getEnv() !== "production",

    beforeSend: (event: ErrorEvent, hint: EventHint) => {
      event.tags = {
        ...event.tags,
        "expo-update-id": Updates.updateId,
        "expo-is-embedded-update": Updates.isEmbeddedLaunch,
      }

      return event
    },
  })
}
