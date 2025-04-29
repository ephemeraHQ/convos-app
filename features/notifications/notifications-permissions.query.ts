import { queryOptions } from "@tanstack/react-query"
import * as Notifications from "expo-notifications"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
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
