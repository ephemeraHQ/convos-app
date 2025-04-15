import { v4 as uuidv4 } from "uuid"
import { config } from "@/config"
import { useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { captureError } from "@/utils/capture-error"
import { XMTPError } from "@/utils/error"
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
        error: new Error(`Calling "${xmtpFunctionName}" took ${durationMs}ms`),
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
  const operationId = uuidv4()
  const { addOperation, removeOperation } = useXmtpActivityStore.getState().actions

  // Record start time and add to store
  const startTime = Date.now()
  addOperation({
    id: operationId,
    name: xmtpFunctionName,
    startTime,
  })

  try {
    // Execute the actual XMTP call with a 30-second timeout
    const result = await withTimeout({
      promise: xmtpCall(),
      timeoutMs: 30000,
      errorMessage: `XMTP operation "${xmtpFunctionName}" timed out after 30 seconds`,
    })

    // Record end time and calculate duration
    const endTime = Date.now()
    const durationMs = endTime - startTime

    xmtpLogger.debug(`XMTP operation "${xmtpFunctionName}" took ${durationMs}ms`)

    // Log error if the request took too long
    logErrorIfXmtpRequestTookTooLong({ durationMs, xmtpFunctionName })

    return result
  } catch (error) {
    // Re-throw the error to be handled by the caller
    // We still want to remove the operation from the store in the finally block
    throw error
  } finally {
    // Always remove the operation from the store, regardless of success or failure
    removeOperation(operationId)
  }
}
