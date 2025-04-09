import { queryOptions } from "@tanstack/react-query"
import * as Notifications from "expo-notifications"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

export const getNotificationsPermissionsQueryConfig = () => {
  return queryOptions({
    queryKey: ["notifications-permissions"],
    queryFn: async () => {
      const permissions = await Notifications.getPermissionsAsync()
      return {
        status: permissions.granted ? "granted" : "denied",
        canAskAgain: permissions.canAskAgain,
      }
    },
    staleTime: Infinity,
  })
}

export function ensureNotificationsPermissions() {
  return reactQueryClient.ensureQueryData(getNotificationsPermissionsQueryConfig())
}
