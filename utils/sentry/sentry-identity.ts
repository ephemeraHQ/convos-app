import * as Sentry from "@sentry/react-native"
import { getEnv } from "@/utils/getEnv"
import { sentryLogger } from "@/utils/logger/logger"

export function sentryIdentifyUser(args: { userId?: string; username?: string; name?: string }) {
  sentryLogger.debug("Identifying user", {
    userId: args.userId,
    ...(getEnv() !== "production" && {
      username: args.username,
      name: args.name,
    }),
  })

  Sentry.setUser({
    id: args.userId,
    ...(getEnv() !== "production" && {
      username: args.username,
      name: args.name,
    }),
  })

  Sentry.setContext("user", {
    id: args.userId,
    ...(getEnv() !== "production" && {
      username: args.username,
      name: args.name,
    }),
  })
}
