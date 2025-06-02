import { AppState, AppStateStatus } from "react-native"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

type State = {
  currentState: AppStateStatus
  previousState: AppStateStatus | null
}

type Actions = {
  handleAppStateChange: (nextAppState: AppStateStatus) => void
}

type AppStateStore = State & { actions: Actions }

export const useAppStateStore = create<AppStateStore>()(
  subscribeWithSelector((set) => ({
    currentState: AppState.currentState,
    previousState: null,

    actions: {
      handleAppStateChange: (nextAppState) => {
        set((state) => {
          return {
            previousState: state.currentState,
            currentState: nextAppState,
          }
        })
      },
    },
  })),
)
