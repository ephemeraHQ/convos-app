import * as Sentry from "@sentry/react-native"
import { config } from "@/config"
// import { useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { captureError } from "@/utils/capture-error"
import { XMTPError } from "@/utils/error"
import { getRandomId } from "@/utils/general"
import { xmtpLogger } from "@/utils/logger/logger"
import { withTimeout } from "@/utils/promise-timeout"

export function logErrorIfXmtpRequestTookTooLong(args: {
  durationMs: number
  xmtpFunctionName: string
}) {
  const { durationMs, xmtpFunctionName } = args

  if (durationMs > config.xmtp.maxMsUntilLogError) {
    captureError(
      new XMTPError({
        error: new Error(`Calling "${xmtpFunctionName}" took ${Math.round(durationMs / 1000)}s`),
      }),
    )
  }
}

/**
 * Wraps an async XMTP SDK call using the modified withTimeout.
 * The operation can be cancelled externally (e.g., by app backgrounding)
 * via the useXmtpActivityStore. Includes Sentry tracing and timeout.
 */
export async function wrapXmtpCallWithDuration<T>(
  xmtpFunctionName: string,
  xmtpCall: () => Promise<T>,
): Promise<T> {
  const operationId = getRandomId()
  // const { addOperation, removeOperation } = useXmtpActivityStore.getState().actions
  const startTime = Date.now()

  try {
    xmtpLogger.debug(`Operation [${operationId}] "${xmtpFunctionName}" started...`)

    const xmtpSpanCall = Sentry.startSpan({ name: xmtpFunctionName, op: "XMTP" }, async () => {
      // console.log("waiting for 5 seconds")
      // await wait(5000) // Simulate slow XMTP calls
      // console.log("done waiting for 5 seconds")
      return await xmtpCall()
    })

    // Execute with the modified timeout, getting the promise and cancel function
    const {
      promise: timedPromise,
      // cancel
    } = withTimeout({
      promise: xmtpSpanCall,
      timeoutMs: 15000, // Timeout remains as a safety net
      errorMessage: `Operation "${xmtpFunctionName}" timed out after 15 seconds`,
    })

    // NOW add the operation to the store with the ACTUAL cancel function
    // addOperation({
    //   id: operationId,
    //   name: xmtpFunctionName,
    //   startTime,
    //   cancel,
    // })

    // Await the result (this promise will reject if cancelled externally or timed out)
    const result = await timedPromise

    // If we reach here, it succeeded without timeout or cancellation
    const endTime = Date.now()
    const totalDurationMs = endTime - startTime
    xmtpLogger.debug(
      `Operation [${operationId}] "${xmtpFunctionName}" finished successfully in ${totalDurationMs}ms.`,
    )
    logErrorIfXmtpRequestTookTooLong({ durationMs: totalDurationMs, xmtpFunctionName })

    return result
  } catch (error) {
    xmtpLogger.error(`Operation [${operationId}] "${xmtpFunctionName}" failed: ${error}`)
    throw error
  } finally {
    // removeOperation(operationId)
  }
}
