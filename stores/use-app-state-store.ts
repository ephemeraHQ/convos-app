import { focusManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { AppState, AppStateStatus } from "react-native"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { logger } from "@/utils/logger/logger"

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

// Just for debugging
useAppStateStore.subscribe(
  (state) => state.currentState,
  (currentState, previousState) => {
    logger.debug(`App state changed from '${previousState}' to '${currentState}'`)
  },
)

// Update the new state
AppState.addEventListener("change", (nextAppState) => {
  focusManager.setFocused(nextAppState === "active")
  useAppStateStore.getState().actions.handleAppStateChange(nextAppState)
})

type IAppStateHandlerSettings = {
  onChange?: (status: AppStateStatus) => void
  onForeground?: () => void
  onBackground?: () => void
  onInactive?: () => void
  deps?: React.DependencyList
}

export const useAppStateHandler = (settings?: IAppStateHandlerSettings) => {
  const { onChange, onForeground, onBackground, onInactive, deps = [] } = settings || {}

  useEffect(() => {
    return useAppStateStore.subscribe(
      (state) => ({ current: state.currentState, previous: state.previousState }),
      (next, prev) => {
        if (next.current === "active" && prev?.current !== "active") {
          onForeground?.()
        } else if (prev?.current === "active" && next.current === "background") {
          onBackground?.()
        } else if (prev?.current === "active" && next.current === "inactive") {
          onInactive?.()
        }

        onChange?.(next.current)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, onForeground, onBackground, onInactive, ...deps])
}

export const waitUntilAppActive = async () => {
  // If app is active, return immediately
  if (useAppStateStore.getState().currentState === "active") {
    return
  }

  logger.debug(`Waiting until app is back into active state...`)

  return new Promise<void>((resolve) => {
    const unsubscribe = useAppStateStore.subscribe(
      (state) => state.currentState,
      (currentState) => {
        if (currentState === "active") {
          unsubscribe()
          resolve()
        }
      },
    )
  })
}

export function useAppLaunchedForBackgroundStuff() {
  return useAppStateStore(
    (state) =>
      state.currentState === "background" &&
      (state.previousState === "inactive" || !state.previousState),
  )
}
