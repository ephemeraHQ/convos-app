import { useCurrentUserQuery } from "@/features/current-user/current-user.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { useEffectWhenCondition } from "@/hooks/use-effect-once-when-condition"
import { captureError } from "@/utils/capture-error"

export function useStartListeningToCurrentUserQuery() {
  const { data: currentUser } = useCurrentUserQuery()

  useEffectWhenCondition(() => {
    if (!currentUser) {
      return
    }

    registerPushNotifications().catch(captureError)
  }, !!currentUser)
}
