import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useCurrentUserQuery } from "@/features/current-user/current-user.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { captureError } from "@/utils/capture-error"

export function useStartListeningToCurrentUserQuery() {
  const { data: currentUser } = useCurrentUserQuery()
  const authStatus = useAuthenticationStore((s) => s.status)

  useEffect(() => {
    if (!currentUser?.id || authStatus !== "signedIn") {
      return
    }

    registerPushNotifications().catch(captureError)
  }, [currentUser?.id, authStatus])
}
