import { create } from "zustand"
import { persist } from "zustand/middleware"
import { notificationsStoreStorage } from "@/utils/storage/storages"

type INotificationsState = {
  lastHandledNotificationId: string | null
}

type INotificationsActions = {
  reset: () => void
  setLastHandledNotificationId: (notificationId: string) => void
}

type INotificationsStore = INotificationsState & {
  actions: INotificationsActions
}

const initialState: INotificationsState = {
  lastHandledNotificationId: null,
}

const STORE_NAME = "notifications-storage"

export const useNotificationsStore = create<INotificationsStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      actions: {
        reset: () => {
          set(initialState)
          notificationsStoreStorage.removeItem(STORE_NAME)
        },
        setLastHandledNotificationId: (notificationId: string) =>
          set({ lastHandledNotificationId: notificationId }),
      },
    }),
    {
      name: STORE_NAME,
      version: 2,
      storage: notificationsStoreStorage,
      partialize(state) {
        const { actions, ...rest } = state
        return {
          ...rest,
        }
      },
    },
  ),
)
