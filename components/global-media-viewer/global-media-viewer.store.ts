import { create } from "zustand"
import { IMediaViewerProps } from "../../features/conversation/conversation-chat/conversation-media-viewer/conversation-media-viewer.types"

type MediaViewerParams = Omit<IMediaViewerProps, "visible" | "onClose">

type IGlobalMediaViewerState = {
  mediaParams: MediaViewerParams | null
  actions: {
    openGlobalMediaViewer: (params: MediaViewerParams) => void
    closeGlobalMediaViewer: () => void
  }
}

export const useGlobalMediaViewerStore = create<IGlobalMediaViewerState>((set) => ({
  mediaParams: null,

  actions: {
    openGlobalMediaViewer: (params) => {
      set({ mediaParams: params })
    },
    closeGlobalMediaViewer: () => set({ mediaParams: null }),
  },
}))
