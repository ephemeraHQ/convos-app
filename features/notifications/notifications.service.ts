import { ensureNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"

export async function userHasGrantedNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.status === "granted"
}

export async function canAskForNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.canAskAgain
}
