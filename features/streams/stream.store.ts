import { create } from "zustand"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"

type IStreamStatusState = {
  streamStatus: Record<IXmtpInboxId, boolean>
  actions: {
    setStreamStarted: (args: { inboxId: IXmtpInboxId }) => void
    setStreamStopped: (args: { inboxId: IXmtpInboxId }) => void
  }
}

export const useStreamStatusStore = create<IStreamStatusState>((set) => ({
  streamStatus: {},
  actions: {
    setStreamStarted: ({ inboxId }) =>
      set((state) => ({
        streamStatus: { ...state.streamStatus, [inboxId]: true },
      })),
    setStreamStopped: ({ inboxId }) =>
      set((state) => {
        const newStatus = { ...state.streamStatus }
        delete newStatus[inboxId] // Or set to false: newStatus[inboxId] = false; depends on desired logic
        return { streamStatus: newStatus }
      }),
  },
}))
