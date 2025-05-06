import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getCurrentUserQueryOptions } from "@/features/current-user/current-user.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { captureError } from "@/utils/capture-error"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"

export function useStartListeningToCurrentUserQuery() {
  const authStatus = useAuthenticationStore((state) => state.status)

  useEffect(() => {
    if (authStatus !== "signedIn") {
      return
    }

    const { unsubscribe } = createQueryObserverWithPreviousData({
      queryOptions: getCurrentUserQueryOptions({ caller: "useStartListeningToCurrentUserQuery" }),
      observerCallbackFn: (result) => {
        if (result.data) {
          registerPushNotifications().catch(captureError)
        }
      },
    })

    return () => unsubscribe()
  }, [authStatus])
}
