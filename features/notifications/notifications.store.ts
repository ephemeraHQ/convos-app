import { create } from "zustand"
import { persist } from "zustand/middleware"
import { notificationsStorage } from "@/utils/storage/storages"

type INotificationsState = {
  lastHandledNotificationId: string | null
}

type INotificationsActions = {
  setLastHandledNotificationId: (notificationId: string) => void
}

type INotificationsStore = INotificationsState & {
  actions: INotificationsActions
}

const initialState: INotificationsState = {
  lastHandledNotificationId: null,
}

export const useNotificationsStore = create<INotificationsStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      actions: {
        setLastHandledNotificationId: (notificationId: string) =>
          set({ lastHandledNotificationId: notificationId }),
      },
    }),
    {
      name: "notifications-storage",
      version: 2,
      storage: notificationsStorage,
      partialize(state) {
        const { actions, ...rest } = state
        return {
          ...rest,
        }
      },
    },
  ),
)
