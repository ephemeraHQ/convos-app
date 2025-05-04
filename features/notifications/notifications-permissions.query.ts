import { queryOptions } from "@tanstack/react-query"
import * as Notifications from "expo-notifications"
import { useEffect } from "react"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import {
  subscribeToAllAllowedConsentConversationsNotifications,
  unsubscribeFromAllConversationsNotifications,
} from "@/features/notifications/notifications-conversations-subscriptions"
import { captureError } from "@/utils/capture-error"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"
import { INotificationPermissionStatus } from "./notifications.types"

export const getNotificationsPermissionsQueryConfig = () => {
  return queryOptions({
    queryKey: ["notifications-permissions"],
    queryFn: async () => {
      const permissions = await Notifications.getPermissionsAsync()

      // Convert permissions.status to our INotificationPermissionStatus type
      let status: INotificationPermissionStatus = "denied"

      if (permissions.granted) {
        status = "granted"
      } else if (permissions.status === Notifications.PermissionStatus.UNDETERMINED) {
        status = "notDetermined"
      }

      return {
        status,
        canAskAgain: permissions.canAskAgain,
      }
    },
    staleTime: Infinity,
  })
}

export function ensureNotificationsPermissions() {
  return reactQueryClient.ensureQueryData(getNotificationsPermissionsQueryConfig())
}

export function useStartListeningForNotificationsPermissionsQuery() {
  useEffect(() => {
    const observer = createQueryObserverWithPreviousData({
      queryOptions: getNotificationsPermissionsQueryConfig(),
      observerCallbackFn: (result) => {
        // unsubscribe from all conversations notifications if permission was denied
        if (result.data?.status !== "granted" && result.previousData?.status === "granted") {
          const senders = useMultiInboxStore.getState().senders
          Promise.all(
            senders.map((sender) =>
              unsubscribeFromAllConversationsNotifications({
                clientInboxId: sender.inboxId,
              }),
            ),
          ).catch(captureError)
        }

        // subscribe to all allowed consent conversations notifications if permission was granted
        if (result.previousData?.status === "granted" && !result.previousData.status) {
          const senders = useMultiInboxStore.getState().senders
          Promise.all(
            senders.map((sender) =>
              subscribeToAllAllowedConsentConversationsNotifications({
                clientInboxId: sender.inboxId,
              }),
            ),
          ).catch(captureError)
        }
      },
    })

    return () => {
      observer.unsubscribe()
    }
  }, [])
}
