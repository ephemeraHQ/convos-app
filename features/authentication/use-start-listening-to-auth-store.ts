import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getAllSenders } from "@/features/authentication/multi-inbox.store"
import { registerBackgroundSyncTask } from "@/features/background-sync/background-sync"
import { startStreaming } from "@/features/streams/streams"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"

let subscribedToAuthenticationStore = false

export function startListeningToAuthenticationStore() {
  if (subscribedToAuthenticationStore) {
    return
  }

  useAuthenticationStore.subscribe(
    (state) => state.status,
    async (status) => {
      if (status === "signedIn") {
        const senders = getAllSenders()

        const results = await customPromiseAllSettled([
          startStreaming(senders.map((sender) => sender.inboxId)),
          registerBackgroundSyncTask(),
        ])

        results.forEach((result) => {
          if (result.status === "rejected") {
            captureError(
              new GenericError({
                error: result.reason,
                additionalMessage: "Failed to start streaming and register background sync task",
              }),
            )
          }
        })
      }
    },
    {
      fireImmediately: true,
    },
  )

  subscribedToAuthenticationStore = true
}
