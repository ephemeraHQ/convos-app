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

export const useAppStateStore = create<State & { actions: Actions }>()(
  subscribeWithSelector((set) => ({
    currentState: AppState.currentState,
    previousState: null,

    actions: {
      handleAppStateChange: (nextAppState) =>
        set((state) => {
          return {
            previousState: state.currentState,
            currentState: nextAppState,
          }
        }),
    },
  })),
)

// Update the store when the app state changes
AppState.addEventListener("change", (nextAppState) => {
  useAppStateStore.getState().actions.handleAppStateChange(nextAppState)
})
