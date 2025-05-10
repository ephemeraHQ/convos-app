import { create } from "zustand"

type INotificationsState = {
  lastTappedNotificationId: string | null
}

type INotificationsActions = {
  setLastTappedNotificationId: (notificationId: string) => void
}

type INotificationsStore = INotificationsState & {
  actions: INotificationsActions
}

const initialState: INotificationsState = {
  lastTappedNotificationId: null,
}

export const useNotificationsStore = create<INotificationsStore>((set, get) => ({
  ...initialState,
  actions: {
    setLastTappedNotificationId: (notificationId: string) =>
      set({ lastTappedNotificationId: notificationId }),
  },
}))
