import { useEffect } from "react"
import { getCurrentUserQueryOptions } from "@/features/current-user/current-user.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { captureError } from "@/utils/capture-error"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"

export function useStartListeningToCurrentUserQuery() {
  useEffect(() => {
    const { unsubscribe } = createQueryObserverWithPreviousData({
      queryOptions: getCurrentUserQueryOptions({ caller: "useStartListeningToCurrentUserQuery" }),
      observerCallbackFn: (result) => {
        if (result.data) {
          registerPushNotifications().catch(captureError)
        }
      },
    })
    return () => unsubscribe()
  }, [])
}
