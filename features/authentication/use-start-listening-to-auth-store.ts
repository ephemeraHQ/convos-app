import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getAllSenders } from "@/features/authentication/multi-inbox.store"
import { startStreaming } from "@/features/streams/streams"
import { captureError } from "@/utils/capture-error"

export function useStartListeningToAuthenticationStore() {
  useEffect(() => {
    const unsubscribe = useAuthenticationStore.subscribe(
      (state) => state.status,
      (status) => {
        if (status === "signedIn") {
          const senders = getAllSenders()
          startStreaming(senders.map((sender) => sender.inboxId)).catch(captureError)
        }
      },
      {
        fireImmediately: true,
      },
    )
    return () => unsubscribe()
  }, [])
}
