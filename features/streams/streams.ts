import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import {
  startStreamingPreferences,
  stopStreamingPreferences,
} from "@/features/streams/stream-preferences"
import { stopStreamingConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-stream"
import { stopStreamingAllMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-stream"
import { captureError } from "@/utils/capture-error"
import { StreamError } from "@/utils/error"
import { streamLogger } from "@/utils/logger/logger"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"
import { startConversationStreaming } from "./stream-conversations"
import { startMessageStreaming } from "./stream-messages"
import { useStreamStatusStore } from "./stream.store" // Import the store

export async function startStreaming(inboxIdsToStream: IXmtpInboxId[]) {
  const isSignedIn = useAuthenticationStore.getState().status === "signedIn"

  if (!isSignedIn) {
    return
  }

  const { setStreamStarted } = useStreamStatusStore.getState().actions
  const currentStatus = useStreamStatusStore.getState().streamStatus

  for (const inboxId of inboxIdsToStream) {
    if (currentStatus[inboxId]) {
      streamLogger.debug(`Streams already started for ${inboxId}`)
      continue
    }

    streamLogger.debug(`Starting all streams for ${inboxId}...`)

    const results = await customPromiseAllSettled([
      startConversationStreaming({ clientInboxId: inboxId }),
      startMessageStreaming({ clientInboxId: inboxId }),
      startStreamingPreferences({ clientInboxId: inboxId }),
      // startConsentStreaming({ clientInboxId: inboxId }),
    ])

    results.forEach((result) => {
      if (result.status === "rejected") {
        captureError(
          new StreamError({
            error: result.reason,
            additionalMessage: `Failed to start streaming for ${inboxId}`,
          }),
        )
      }
    })

    const someSucceeded = results.some((r) => r.status === "fulfilled")

    if (someSucceeded) {
      setStreamStarted({ inboxId })
      streamLogger.debug(`Started all streams for ${inboxId}`)
    } else {
      streamLogger.debug(`Failed to start all streams for ${inboxId}`)
    }
  }
}

export async function stopStreaming(inboxIds: IXmtpInboxId[]) {
  const { setStreamStopped } = useStreamStatusStore.getState().actions // Get action from store
  const currentStatus = useStreamStatusStore.getState().streamStatus

  await Promise.all(
    inboxIds.map(async (inboxId) => {
      if (!currentStatus[inboxId]) {
        streamLogger.debug(`Streams already stopped for ${inboxId}`)
        return
      }

      streamLogger.debug(`Stopping streams for ${inboxId}...`)

      const results = await customPromiseAllSettled([
        stopStreamingAllMessage({ inboxId }),
        stopStreamingConversations({ inboxId }),
        stopStreamingPreferences({ clientInboxId: inboxId }),
        // stopConsentStreaming({ clientInboxId: inboxId }),
      ])

      results.forEach((result) => {
        if (result.status === "rejected") {
          captureError(
            new StreamError({
              error: result.reason,
              additionalMessage: `Failed to stop streaming for ${inboxId}`,
            }),
          )
        }
      })

      const someSucceeded = results.some((r) => r.status === "fulfilled")
      if (someSucceeded) {
        setStreamStopped({ inboxId })
        streamLogger.debug(`Stopped all streams for ${inboxId}`)
      } else {
        streamLogger.debug(`Failed to stop all streams for ${inboxId}`)
      }
    }),
  )
}
