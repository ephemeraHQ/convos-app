import { create } from "zustand"

export type IXmtpOperation = {
  id: string
  name: string
  startTime: number // Unix timestamp (ms)
}

type IState = {
  activeOperations: Record<string, IXmtpOperation>
}

type IActions = {
  addOperation: (operation: IXmtpOperation) => void
  removeOperation: (id: string) => void
}

export const useXmtpActivityStore = create<IState & { actions: IActions }>((set) => ({
  // State
  activeOperations: {},

  // Actions
  actions: {
    // Using standard Zustand update with object spread
    addOperation: (operation) => {
      set((state) => ({
        activeOperations: {
          ...state.activeOperations,
          [operation.id]: operation,
        },
      }))
    },
    // Using standard Zustand update with object destructuring and delete
    removeOperation: (id) => {
      set((state) => {
        const { [id]: _, ...rest } = state.activeOperations // Destructure to omit the key
        return { activeOperations: rest } // Return new state without the deleted key
      })
    },
  },
}))
