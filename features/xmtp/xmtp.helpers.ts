import { FullMetrics } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import { useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { captureError } from "@/utils/capture-error"
import { XMTPError } from "@/utils/error"
import { getRandomId } from "@/utils/general"
import { xmtpLogger } from "@/utils/logger/logger"
import { withTimeout } from "@/utils/promise-timeout"

export function logErrorIfXmtpRequestTookTooLong(args: {
  durationMs: number
  xmtpFunctionName: string
  metrics: FullMetrics | undefined
}) {
  const { durationMs, xmtpFunctionName, metrics } = args

  if (durationMs > config.xmtp.maxMsUntilLogError) {
    captureError(
      new XMTPError({
        error: new Error(`Calling "${xmtpFunctionName}" took ${durationMs}ms`),
        ...(metrics && { extra: { metrics } }),
      }),
    )
  }
}

/**
 * Wraps an async XMTP SDK call to measure its duration, log potential errors for long requests,
 * and track the operation's progress in the Zustand store.
 */
export async function wrapXmtpCallWithDuration<T>(
  xmtpFunctionName: string,
  xmtpCall: () => Promise<T>,
): Promise<T> {
  const operationId = getRandomId()
  const { addOperation, removeOperation } = useXmtpActivityStore.getState().actions

  // Record start time and add to store
  const startTime = Date.now()
  addOperation({
    id: operationId,
    name: xmtpFunctionName,
    startTime,
  })

  try {
    // Log the start of the XMTP operation
    xmtpLogger.debug(`XMTP operation [${operationId}] "${xmtpFunctionName}" started...`)

    // Execute the actual XMTP call with a 15-second timeout
    const result = await withTimeout({
      promise: xmtpCall(),
      timeoutMs: 15000,
      errorMessage: `XMTP operation "${xmtpFunctionName}" timed out after 15 seconds`,
    })

    // Record end time and calculate duration
    const endTime = Date.now()
    const durationMs = endTime - startTime
    let metrics: FullMetrics | undefined

    if (result && typeof result === "object" && "metrics" in result) {
      metrics = result.metrics as FullMetrics
      xmtpLogger.debug(
        `XMTP operation [${operationId}] "${xmtpFunctionName}" has the following metrics: ${JSON.stringify(metrics)}`,
      )
    }

    xmtpLogger.debug(
      `XMTP operation [${operationId}] "${xmtpFunctionName}" finished in ${durationMs}ms`,
    )

    // Log error if the request took too long
    logErrorIfXmtpRequestTookTooLong({ durationMs, xmtpFunctionName, metrics })

    return result
  } catch (error) {
    // Log the error with operation ID
    xmtpLogger.error(`XMTP operation [${operationId}] "${xmtpFunctionName}" failed: ${error}`)

    // Re-throw the error to be handled by the caller
    // We still want to remove the operation from the store in the finally block
    throw error
  } finally {
    // Always remove the operation from the store, regardless of success or failure
    removeOperation(operationId)
  }
}
