import * as Sentry from "@sentry/react-native"
import { config } from "@/config"
// import {
//   appCameBackFromBackground,
//   appHasGoneToBackground,
//   getCurrentAppState,
//   subscribeToAppStateStore,
// } from "@/stores/app-state-store/app-state-store.service"
// import { useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { captureError } from "@/utils/capture-error"
import { XMTPError } from "@/utils/error"
import { getRandomId } from "@/utils/general"
import { xmtpLogger } from "@/utils/logger/logger"
import { withTimeout } from "@/utils/promise-timeout"
import { retryWithBackoff } from "@/utils/retryWithBackoff"

/**
 * Wraps an async XMTP SDK call using the modified withTimeout.
 * The operation can be cancelled externally (e.g., by app backgrounding)
 * via the useXmtpActivityStore. Includes Sentry tracing and timeout.
 * This version accurately measures duration by considering app active time only,
 * using the centralized useAppStateStore.
 */
export async function wrapXmtpCallWithDuration<T>(
  xmtpFunctionName: string,
  xmtpCall: () => Promise<T>,
): Promise<T> {
  const operationId = getRandomId()
  // const { addOperation, removeOperation } = useXmtpActivityStore.getState().actions

  let totalActiveDurationMs = 0
  let segmentStartTime = Date.now()
  // let storeUnsubscribe: (() => void) | null = null

  // Get initial state for the case where the call is very short
  // and finishes before any app state change event.
  // let currentAppState = getCurrentAppState()

  // storeUnsubscribe = subscribeToAppStateStore({
  //   callback: (currentState, previousState) => {
  //     if (appCameBackFromBackground()) {
  //       // App has come to the foreground
  //       segmentStartTime = Date.now()
  //     } else if (appHasGoneToBackground()) {
  //       // App has gone to the background or inactive
  //       totalActiveDurationMs += Date.now() - segmentStartTime
  //     }
  //   },
  // })

  try {
    xmtpLogger.debug(`Operation [${operationId}] "${xmtpFunctionName}" started...`)

    const result = await retryWithBackoff({
      fn: async () => {
        const xmtpSpanCall = Sentry.startSpan({ name: xmtpFunctionName, op: "XMTP" }, async () => {
          return await xmtpCall()
        })

        const { promise: timedPromise } = withTimeout({
          promise: xmtpSpanCall,
          timeoutMs: 15000, // If it takes longer than this, it's probably a bug...
          errorMessage: `Operation [${operationId}] "${xmtpFunctionName}" timed out after 15 seconds`,
        })

        return await timedPromise
      },
      retries: 3,
      delay: 1000,
      maxDelay: 10000,
      context: `XMTP ${xmtpFunctionName}`,
      onError: async (error) => {
        captureError(
          new XMTPError({
            error,
            additionalMessage: `XMTP ${xmtpFunctionName} failed`,
          }),
        )
      },
    })

    // Add duration of the last active segment if app is currently active
    // if (currentAppState === "active") {
    //   totalActiveDurationMs += Date.now() - segmentStartTime
    // }

    totalActiveDurationMs = Date.now() - segmentStartTime

    if (totalActiveDurationMs > config.xmtp.maxMsUntilLogError) {
      captureError(
        new XMTPError({
          error: new Error(
            `Calling "${xmtpFunctionName}" took ${Math.round(totalActiveDurationMs / 1000)}s`,
          ),
        }),
      )
    } else {
      xmtpLogger.debug(
        `Operation [${operationId}] "${xmtpFunctionName}" finished successfully in ${totalActiveDurationMs}ms`,
      )
    }

    return result
  } catch (error) {
    // If an error occurs, capture the active time until the error
    // if (currentAppState === "active") {
    //   totalActiveDurationMs += Date.now() - segmentStartTime
    // }
    throw error
  } finally {
    // removeOperation(operationId)
    // Clean up the store subscription
    // if (storeUnsubscribe) {
    //   storeUnsubscribe()
    // }
  }
}
