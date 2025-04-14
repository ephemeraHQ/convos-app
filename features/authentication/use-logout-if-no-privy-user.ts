import { usePrivy } from "@privy-io/expo"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { captureError } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"

export function useSignoutIfNoPrivyUser() {
  const { user: privyUser, isReady } = usePrivy()

  // If we don't have a Privy user, we're signed out
  useEffect(() => {
    if (!privyUser && isReady) {
      const currentSender = getCurrentSender()

      // This shouldn't happen normally
      if (currentSender) {
        captureError(
          new AuthenticationError({
            error: new Error("Privy is ready but we can't find Privy user, so signing out"),
          }),
        )
      }

      useAuthenticationStore.getState().actions.setStatus("signedOut")
    }
  }, [privyUser, isReady])
}
