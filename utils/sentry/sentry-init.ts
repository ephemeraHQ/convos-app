import * as Sentry from "@sentry/react-native"
import type { ErrorEvent, EventHint } from "@sentry/types"
import * as Updates from "expo-updates"
import { config } from "@/config"
import { getEnv } from "@/utils/getEnv"

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
})

export function sentryInit() {
  Sentry.init({
    dsn: config.sentry.dsn,
    debug: false,
    enabled: !__DEV__,
    environment: getEnv(),
    // Add more context data to events (IP address, cookies, user, etc.)
    sendDefaultPii: true, // getEnv() !== "production",
    // Attach stacktraces to all messages for more context
    attachStacktrace: true, // getEnv() !== "production",

    // @see https://docs.sentry.io/platforms/react-native/tracing/#configure
    tracesSampleRate: 1.0,
    integrations: [navigationIntegration],

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
