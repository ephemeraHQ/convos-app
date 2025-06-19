import * as BackgroundTask from "expo-background-task"
import * as TaskManager from "expo-task-manager"
import { getAllSenders } from "@/features/authentication/multi-inbox.store"
import { getAllowedConsentConversationsQueryData } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { addConversationNotificationMessageFromStorageInOurCache } from "@/features/notifications/notifications-storage"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { backgroundTaskLogger } from "@/utils/logger/logger"

const BACKGROUND_SYNC_TASK_NAME = "background-sync-task"

export function defineBackgroundSyncTask() {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
    try {
      backgroundTaskLogger.debug("Background sync task started")

      const senders = getAllSenders()

      if (senders.length === 0) {
        backgroundTaskLogger.debug("No senders available, skipping background sync")
        return BackgroundTask.BackgroundTaskResult.Success
      }

      for (const sender of senders) {
        // Add notification messages from storage to our cache
        const allowedConsentConversations = getAllowedConsentConversationsQueryData({
          clientInboxId: sender.inboxId,
        })
        if (!allowedConsentConversations) {
          continue
        }
        for (const conversationId of allowedConsentConversations) {
          await addConversationNotificationMessageFromStorageInOurCache({
            conversationId,
          })
        }
      }

      /**
       * WARNING: XMTP doesn't seem to support background stuff very well... Or at least some people reported some crashes and in
       * Sentry we can see some sync hanging or building client hanging. So for now we will disable until we can dig.
       */
      // Sync all conversations and metadata for each sender
      // const senderSyncResults = await customPromiseAllSettled(
      //   senders.map(async (sender) => {
      //     backgroundTaskLogger.debug(`Starting background sync for sender: ${sender.inboxId}`)

      //     await syncAllXmtpConversations({
      //       clientInboxId: sender.inboxId,
      //       caller: "background-sync-task",
      //     })
      //     await syncNewXmtpConversations({
      //       clientInboxId: sender.inboxId,
      //       caller: "background-sync-task",
      //     })

      //     backgroundTaskLogger.debug(`Completed background sync for sender: ${sender.inboxId}`)
      //   }),
      // )

      // // Log any sender sync failures
      // senderSyncResults.forEach((result, index) => {
      //   if (result.status === "rejected") {
      //     captureError(
      //       new GenericError({
      //         error: result.reason,
      //         additionalMessage: `Failed to sync data for sender ${senders[index].inboxId}`,
      //       }),
      //     )
      //   }
      // })

      backgroundTaskLogger.debug("Background sync task completed successfully")
      return BackgroundTask.BackgroundTaskResult.Success
    } catch (error) {
      captureError(
        new GenericError({
          error,
          additionalMessage: "Background sync task failed",
        }),
      )
      return BackgroundTask.BackgroundTaskResult.Failed
    }
  })
}

export async function registerBackgroundSyncTask() {
  try {
    const isAlreadyRegistered = await isBackgroundSyncTaskRegistered()

    if (isAlreadyRegistered) {
      backgroundTaskLogger.debug(
        "Background sync task is already registered, skipping registration",
      )
      return
    }

    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
      minimumInterval: 30, // Every 30 minutes
    })
    backgroundTaskLogger.debug("Background sync task registered successfully")
  } catch (error) {
    throw new GenericError({
      error,
      additionalMessage: "Failed to register background sync task",
    })
  }
}

export async function unregisterBackgroundSyncTask() {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME)
    backgroundTaskLogger.debug("Background sync task unregistered successfully")
  } catch (error) {
    throw new GenericError({
      error,
      additionalMessage: "Failed to unregister background sync task",
    })
  }
}

export async function getBackgroundTaskStatus() {
  try {
    return await BackgroundTask.getStatusAsync()
  } catch (error) {
    throw new GenericError({
      error,
      additionalMessage: "Failed to get background task status",
    })
  }
}

export async function isBackgroundSyncTaskRegistered() {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME)
  } catch (error) {
    throw new GenericError({
      error,
      additionalMessage: "Failed to check if background sync task is registered",
    })
  }
}
