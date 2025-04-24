import { usePrivy } from "@privy-io/expo"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useLogout } from "@/features/authentication/use-logout"
import { captureError } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"

export function useSignoutIfNoPrivyUser() {
  const { user: privyUser, isReady } = usePrivy()
  const { logout } = useLogout()
  const authStatus = useAuthenticationStore((state) => state.status)

  // If we don't have a Privy user, we're signed out
  useEffect(() => {
    if (!privyUser && isReady && authStatus === "signedIn") {
      const currentSender = getCurrentSender()

      // This shouldn't happen normally
      if (currentSender) {
        captureError(
          new AuthenticationError({
            error: new Error("Privy is ready but we can't find Privy user, so signing out"),
          }),
        )
        logout({ caller: "useSignoutIfNoPrivyUser" }).catch(captureError)
      }
    }
  }, [privyUser, isReady, logout, authStatus])
}
