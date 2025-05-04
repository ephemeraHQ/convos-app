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

export async function startStreaming(inboxIdsToStream: IXmtpInboxId[]) {
  const isSignedIn = useAuthenticationStore.getState().status === "signedIn"

  if (!isSignedIn) {
    return
  }

  for (const inboxId of inboxIdsToStream) {
    streamLogger.debug(`Starting all streams for ${inboxId}...`)

    // Start each stream and handle errors individually
    try {
      await startConversationStreaming({ clientInboxId: inboxId })
    } catch (error) {
      captureError(
        new StreamError({
          error,
          additionalMessage: `Failed to start conversation streaming for ${inboxId}`,
        }),
      )
    }

    try {
      await startMessageStreaming({ clientInboxId: inboxId })
    } catch (error) {
      captureError(
        new StreamError({
          error,
          additionalMessage: `Failed to start message streaming for ${inboxId}`,
        }),
      )
    }

    try {
      await startStreamingPreferences({ clientInboxId: inboxId })
    } catch (error) {
      captureError(
        new StreamError({
          error,
          additionalMessage: `Failed to start preference streaming for ${inboxId}`,
        }),
      )
    }

    // try {
    //   await startConsentStreaming({ clientInboxId: inboxId })
    // } catch (error) {
    //   captureError(
    //     new StreamError({
    //       error,
    //       additionalMessage: `Failed to start consent streaming for ${inboxId}`,
    //     }),
    //   )
    // }

    streamLogger.debug(`Started all streams for ${inboxId}`)
  }
}

export async function stopStreaming(inboxIds: IXmtpInboxId[]) {
  await Promise.all(
    inboxIds.map(async (inboxId) => {
      streamLogger.debug(`Stopping streams for ${inboxId}...`)

      // Stop each stream and handle errors individually
      try {
        await stopStreamingAllMessage({ inboxId })
      } catch (error) {
        captureError(
          new StreamError({
            error,
            additionalMessage: `Failed to stop message streaming for ${inboxId}`,
          }),
        )
      }

      try {
        await stopStreamingConversations({ inboxId })
      } catch (error) {
        captureError(
          new StreamError({
            error,
            additionalMessage: `Failed to stop conversation streaming for ${inboxId}`,
          }),
        )
      }

      try {
        await stopStreamingPreferences({ clientInboxId: inboxId })
      } catch (error) {
        captureError(
          new StreamError({
            error,
            additionalMessage: `Failed to stop preference streaming for ${inboxId}`,
          }),
        )
      }

      // try {
      //   await stopConsentStreaming({ clientInboxId: inboxId })
      // } catch (error) {
      //   captureError(
      //     new StreamError({
      //       error,
      //       additionalMessage: `Failed to stop consent streaming for ${inboxId}`,
      //     }),
      //   )
      // }

      streamLogger.debug(`Stopped all streams for ${inboxId}`)
    }),
  )
}
