import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { stopStreamingConversations } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-stream"
import { stopStreamingAllMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-stream"
import { useAppStore } from "@/stores/app-store"
import { useAppStateStore } from "@/stores/use-app-state-store"
import { captureError } from "@/utils/capture-error"
import { StreamError } from "@/utils/error"
import { streamLogger } from "@/utils/logger/logger"
import { startConversationStreaming } from "./stream-conversations"
import { startMessageStreaming } from "./stream-messages"
import { useStreamingStore } from "./stream-store"

export function useSetupStreamingSubscriptions() {
  // Start/stop streaming when internet connectivity changes
  // TODO: Fix this, we need to combine with the accounts store subscription below
  // useAppStore.subscribe(
  //   (state) => state.isInternetReachable,
  //   (isInternetReachable) => {
  //     streamLogger.debug(
  //       `Internet reachability changed: ${isInternetReachable}`
  //     );
  //     if (!isInternetReachable) {
  //       return;
  //     }

  //     startStreaming(getAccountsList());
  //   }
  // );

  useEffect(() => {
    // Handle app state changes
    const unsubscribeAppStateStore = useAppStateStore.subscribe(
      (state) => state.currentState,
      (currentState, previousState) => {
        const isSignedIn = useAuthenticationStore.getState().status === "signedIn"
        if (!isSignedIn) {
          return
        }

        const senders = useMultiInboxStore.getState().senders
        const inboxIds = senders.map((sender) => sender.inboxId)

        if (inboxIds.length === 0) {
          return
        }

        if (currentState === "active") {
          streamLogger.debug("App became active, restarting streams")
          startStreaming(inboxIds).catch(captureError)
        }
        // We were active and went to background
        else if (currentState === "background" && previousState === "active") {
          streamLogger.debug("App went to background, stopping streams")
          stopStreaming(inboxIds).catch(captureError)
        }
      },
      {
        fireImmediately: true,
      },
    )

    // Handle account changes
    const unsubscribeMultiInboxStore = useMultiInboxStore.subscribe(
      (state) => [state.senders] as const,
      ([senders], [previousSenders]) => {
        const isSignedIn = useAuthenticationStore.getState().status === "signedIn"
        if (!isSignedIn) {
          return
        }

        const { isInternetReachable } = useAppStore.getState()
        const { currentState } = useAppStateStore.getState()

        // Only manage streams if app is active and has internet
        if (!isInternetReachable || currentState !== "active") {
          return
        }

        const previousInboxIds = previousSenders.map((sender) => sender.inboxId)

        const currentInboxIds = senders.map((sender) => sender.inboxId)

        // Start streaming for new senders
        const newInboxIds = currentInboxIds.filter((inboxId) => !previousInboxIds.includes(inboxId))

        if (newInboxIds.length > 0) {
          startStreaming(newInboxIds).catch(captureError)
        }

        // Stop streaming for removed senders
        const removedInboxIds = previousInboxIds.filter(
          (inboxId) => !currentInboxIds.includes(inboxId),
        )

        if (removedInboxIds.length > 0) {
          stopStreaming(removedInboxIds).catch(captureError)
        }
      },
      {
        fireImmediately: true,
      },
    )

    // Handle authentication state changes
    const unsubscribeAuthStore = useAuthenticationStore.subscribe(
      (state) => state.status,
      (status, previousStatus) => {
        const { currentState } = useAppStateStore.getState()

        // Only handle if app is active
        if (currentState !== "active") {
          return
        }

        if (status === "signedIn") {
          // Start streaming when signed in
          const senders = useMultiInboxStore.getState().senders
          const inboxIds = senders.map((sender) => sender.inboxId)

          if (inboxIds.length > 0) {
            startStreaming(inboxIds).catch(captureError)
          }
        } else if (previousStatus === "signedIn") {
          // Stop streaming when signed out
          const senders = useMultiInboxStore.getState().senders
          const inboxIds = senders.map((sender) => sender.inboxId)

          if (inboxIds.length > 0) {
            stopStreaming(inboxIds).catch(captureError)
          }
        }
      },
      {
        fireImmediately: true,
      },
    )

    return () => {
      unsubscribeAppStateStore()
      unsubscribeMultiInboxStore()
      unsubscribeAuthStore()
    }
  }, [])
}

async function startStreaming(inboxIdsToStream: IXmtpInboxId[]) {
  const store = useStreamingStore.getState()
  const isSignedIn = useAuthenticationStore.getState().status === "signedIn"

  return

  if (!isSignedIn) {
    return
  }

  for (const inboxId of inboxIdsToStream) {
    const streamingState = store.accountStreamingStates[inboxId]

    if (!streamingState?.isStreamingConversations) {
      try {
        streamLogger.debug(`Starting conversation stream for ${inboxId}...`)
        await startConversationStreaming({ clientInboxId: inboxId })
        store.actions.updateStreamingState(inboxId, {
          isStreamingConversations: true,
        })
        streamLogger.debug(`Successfully started conversation stream for ${inboxId}`)
      } catch (error) {
        store.actions.updateStreamingState(inboxId, {
          isStreamingConversations: false,
        })
        captureError(
          new StreamError({ error, additionalMessage: "Error starting conversation stream" }),
        )
      }
    }

    if (!streamingState?.isStreamingMessages) {
      try {
        streamLogger.debug(`Starting messages stream for ${inboxId}...`)
        await startMessageStreaming({ clientInboxId: inboxId })
        store.actions.updateStreamingState(inboxId, {
          isStreamingMessages: true,
        })
        streamLogger.debug(`Successfully started messages stream for ${inboxId}`)
      } catch (error) {
        store.actions.updateStreamingState(inboxId, {
          isStreamingMessages: false,
        })
        captureError(
          new StreamError({ error, additionalMessage: "Error starting messages stream" }),
        )
      }
    }

    // TODO: Fix and handle the consent stream. I think needed for notifications
    // if (!streamingState?.isStreamingConsent) {
    //   streamLogger.debug(`Starting consent stream for ${account}`);
    //   try {
    //     store.actions.updateStreamingState(account, {
    //       isStreamingConsent: true,
    //     });
    //     await startConsentStreaming(account);
    //   } catch (error) {
    //     store.actions.updateStreamingState(account, {
    //       isStreamingConsent: false,
    //     });
    //     captureError(error);
    //   }
    // }
  }
}

async function stopStreaming(inboxIds: IXmtpInboxId[]) {
  const store = useStreamingStore.getState()

  await Promise.all(
    inboxIds.map(async (inboxId) => {
      const streamingState = store.accountStreamingStates[inboxId]

      // Skip if there's no streaming state for this inbox
      if (!streamingState) {
        return
      }

      try {
        streamLogger.debug(`Stopping streams for ${inboxId}...`)

        const stopPromises = []

        // Only stop message streaming if it's active
        if (streamingState.isStreamingMessages) {
          stopPromises.push(stopStreamingAllMessage({ inboxId }))
        }

        // Only stop conversation streaming if it's active
        if (streamingState.isStreamingConversations) {
          stopPromises.push(stopStreamingConversations({ inboxId }))
        }

        // Only stop consent streaming if it's active (commented out for now)
        // if (streamingState.isStreamingConsent) {
        //   stopPromises.push(stopStreamingConsent({ inboxId }))
        // }

        if (stopPromises.length > 0) {
          await Promise.all(stopPromises)
          streamLogger.debug(`Stopped streams for ${inboxId}`)
        } else {
          streamLogger.debug(`No active streams to stop for ${inboxId}`)
        }
      } catch (error) {
        captureError(
          new StreamError({
            error,
            additionalMessage: `Failed to stop streams for ${inboxId}`,
          }),
        )
      } finally {
        store.actions.resetAccount(inboxId)
      }
    }),
  )
}
