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
import { startConversationStreaming } from "./stream-conversations"
import { startMessageStreaming } from "./stream-messages"

// Registry to track active streams
const activeStreams = new Set<IXmtpInboxId>()

export async function startStreaming(inboxIdsToStream: IXmtpInboxId[]) {
  const isSignedIn = useAuthenticationStore.getState().status === "signedIn"

  if (!isSignedIn) {
    return
  }

  for (const inboxId of inboxIdsToStream) {
    // Skip if stream is already active for this inbox
    if (activeStreams.has(inboxId)) {
      continue
    }

    try {
      // Mark this inbox as having active streams before starting
      activeStreams.add(inboxId)

      streamLogger.debug(`Starting all streams for ${inboxId}...`)

      // Start all streams in parallel and handle errors individually
      await Promise.allSettled([
        startConversationStreaming({ clientInboxId: inboxId }).catch((error) => {
          captureError(
            new StreamError({
              error,
              additionalMessage: `Failed to start conversation streaming for ${inboxId}`,
            }),
          )
        }),
        startMessageStreaming({ clientInboxId: inboxId }).catch((error) => {
          captureError(
            new StreamError({
              error,
              additionalMessage: `Failed to start message streaming for ${inboxId}`,
            }),
          )
        }),
        startStreamingPreferences({ clientInboxId: inboxId }).catch((error) => {
          captureError(
            new StreamError({
              error,
              additionalMessage: `Failed to start preference streaming for ${inboxId}`,
            }),
          )
        }),
        // startConsentStreaming({ clientInboxId: inboxId }).catch(error => {
        //   captureError(
        //     new StreamError({
        //       error,
        //       additionalMessage: `Failed to start consent streaming for ${inboxId}`,
        //     }),
        //   )
        // }),
      ])

      streamLogger.debug(`Started all streams for ${inboxId}`)
    } catch (error) {
      // Remove from active streams on error
      activeStreams.delete(inboxId)

      captureError(
        new StreamError({
          error,
          additionalMessage: `Error starting streams for inbox ${inboxId}`,
        }),
      )
    }
  }
}

export async function stopStreaming(inboxIds: IXmtpInboxId[]) {
  await Promise.all(
    inboxIds.map(async (inboxId) => {
      // Skip if no active stream for this inbox
      if (!activeStreams.has(inboxId)) {
        return
      }

      try {
        streamLogger.debug(`Stopping streams for ${inboxId}...`)

        // Stop all streams in parallel and handle errors individually
        await Promise.allSettled([
          stopStreamingAllMessage({ inboxId }).catch((error) => {
            captureError(
              new StreamError({
                error,
                additionalMessage: `Failed to stop message streaming for ${inboxId}`,
              }),
            )
          }),
          stopStreamingConversations({ inboxId }).catch((error) => {
            captureError(
              new StreamError({
                error,
                additionalMessage: `Failed to stop conversation streaming for ${inboxId}`,
              }),
            )
          }),
          stopStreamingPreferences({ clientInboxId: inboxId }).catch((error) => {
            captureError(
              new StreamError({
                error,
                additionalMessage: `Failed to stop preference streaming for ${inboxId}`,
              }),
            )
          }),
          // stopConsentStreaming({ clientInboxId: inboxId }).catch(error => {
          //   captureError(
          //     new StreamError({
          //       error,
          //       additionalMessage: `Failed to stop consent streaming for ${inboxId}`,
          //     }),
          //   )
          // }),
        ])

        streamLogger.debug(`Stopped all streams for ${inboxId}`)
      } catch (error) {
        captureError(
          new StreamError({
            error,
            additionalMessage: `Unexpected error stopping streams for ${inboxId}`,
          }),
        )
      } finally {
        // Always remove from active streams, even if there was an error
        activeStreams.delete(inboxId)
      }
    }),
  )
}
