import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { stopStreamingConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-stream"
import { stopStreamingAllMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-stream"
import { usePrevious } from "@/hooks/use-previous-value"
import { useAppStore } from "@/stores/app-store"
import { useAppStateStore } from "@/stores/use-app-state-store"
import { captureError } from "@/utils/capture-error"
import { StreamError } from "@/utils/error"
import { streamLogger } from "@/utils/logger/logger"
import { startConversationStreaming } from "./stream-conversations"
import { startMessageStreaming } from "./stream-messages"

// Registry to track active streams
const activeStreams = new Set<IXmtpInboxId>()

export function useSetupStreamingSubscriptions() {
  const senders = useMultiInboxStore((state) => state.senders)
  const currentAppState = useAppStateStore((state) => state.currentState)
  const isInternetReachable = useAppStore((state) => state.isInternetReachable)

  const previousAppState = usePrevious(currentAppState)
  const previousSenders = usePrevious(senders)

  // Consolidated effect to handle all stream lifecycle events
  useEffect(() => {
    const inboxIds = senders.map((sender) => sender.inboxId)

    if (inboxIds.length === 0) {
      return
    }

    const isSignedIn = useAuthenticationStore.getState().status === "signedIn"
    const isAppActive = currentAppState === "active"
    const wasAppActive = previousAppState === "active"

    // CASE 1: Stop streams when app goes to background
    if (isSignedIn && wasAppActive && !isAppActive) {
      streamLogger.debug("App went to background, stopping streams")
      stopStreaming(inboxIds).catch(captureError)
      return
    }

    // START STREAMING CASES - all require these conditions
    if (!isSignedIn || !isAppActive || !isInternetReachable) {
      return
    }

    // CASE 3: Start streams when app becomes active
    if (!wasAppActive) {
      streamLogger.debug("App became active, starting streams")
      startStreaming(inboxIds).catch(captureError)
      return
    }

    // CASE 5: Sender list changed
    const prevIds = previousSenders?.map((sender) => sender.inboxId) || []
    const hasNewInboxes = inboxIds.some((id) => !prevIds.includes(id))

    if (hasNewInboxes) {
      streamLogger.debug(
        `New inbox(es) detected, starting streams for all current inboxes (${inboxIds.length})`,
      )
      startStreaming(inboxIds).catch(captureError)
    }
  }, [currentAppState, previousAppState, senders, previousSenders, isInternetReachable])
}

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

      // Start conversation streaming
      streamLogger.debug(`Starting conversation stream for ${inboxId}...`)
      await startConversationStreaming({ clientInboxId: inboxId })

      // Start message streaming
      streamLogger.debug(`Starting messages stream for ${inboxId}...`)
      await startMessageStreaming({ clientInboxId: inboxId })

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

        // Stop message streaming
        await stopStreamingAllMessage({ inboxId })

        // Stop conversation streaming
        await stopStreamingConversations({ inboxId })

        streamLogger.debug(`Stopped all streams for ${inboxId}`)
      } catch (error) {
        captureError(
          new StreamError({
            error,
            additionalMessage: `Failed to stop streams for ${inboxId}`,
          }),
        )
      } finally {
        // Always remove from active streams, even if there was an error
        activeStreams.delete(inboxId)
      }
    }),
  )
}
