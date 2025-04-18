import React, { memo } from "react"
import { MediaViewer } from "../../features/conversation/conversation-chat/conversation-media-viewer/conversation-media-viewer"
import { useGlobalMediaViewerStore } from "./global-media-viewer.store"

/**
 * This component listens for global media viewer events and displays the MediaViewer
 */
export const GlobalMediaViewerPortal = memo(function GlobalMediaViewerPortal() {
  const mediaParams = useGlobalMediaViewerStore((state) => state.mediaParams)
  const closeMediaViewer = useGlobalMediaViewerStore(
    (state) => state.actions.closeGlobalMediaViewer,
  )

  const visible = !!mediaParams

  if (!mediaParams) {
    return null
  }

  return (
    <MediaViewer
      visible={visible}
      onClose={closeMediaViewer}
      uri={mediaParams.uri}
      sender={mediaParams.sender}
      timestamp={mediaParams.timestamp}
    />
  )
})
