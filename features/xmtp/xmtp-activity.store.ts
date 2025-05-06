// features/xmtp/xmtp-activity.store.ts
import { create } from "zustand"
import { xmtpLogger } from "@/utils/logger/logger"

export type IXmtpOperation = {
  id: string
  name: string
  startTime: number
  cancel: (reason: Error) => void
}

type State = {
  operations: Record<string, IXmtpOperation>
}

type Actions = {
  addOperation: (operation: IXmtpOperation) => void
  removeOperation: (id: string) => void
  cancelAllActiveOperations: (reason: Error) => void
}

export const useXmtpActivityStore = create<State & { actions: Actions }>()((set, get) => ({
  operations: {},
  actions: {
    addOperation: (operation) =>
      set((state) => {
        state.operations[operation.id] = operation
        return state
      }),
    removeOperation: (id) =>
      set((state) => {
        const newState = { ...state }
        if (newState.operations[id]) {
          delete newState.operations[id]
        }
        return newState
      }),
    cancelAllActiveOperations: (reason: Error) => {
      const currentOps = get().operations
      xmtpLogger.debug(
        `Triggering cancellation for ${Object.keys(currentOps).length} active operations.`,
      )
      Object.values(currentOps).forEach((op) => {
        xmtpLogger.debug(`[${op.id}] Cancelling: ${op.name}`)
        op.cancel(reason)
      })
    },
  },
}))
