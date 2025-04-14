import React, { useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { MediaViewer } from "./conversation-media-viewer"
import { mediaViewerManager } from "./global-media-viewer"

type IUseMediaViewerOptions = {
  formatTimestamp?: (timestamp: number) => string
}

// Standalone MediaViewer component with Portal (to be used at screen level)
export function MediaViewerPortal() {
  const [isVisible, setIsVisible] = useState(false)
  const [uri, setUri] = useState("")
  const [sender, setSender] = useState("")
  const [timestamp, setTimestamp] = useState("")
  
  const formatTimestampFn = useCallback(
    (ts: number) => format(new Date(ts), "MMM d, yyyy h:mm a"),
    []
  )

  // Register to receive media viewer open events
  useEffect(() => {
    // Handler function
    const handleOpenMediaViewer = (params: {
      uri: string
      sender?: string
      timestamp?: number
    }) => {
      console.log("MediaViewerPortal received event:", params.uri)
      setUri(params.uri)
      setSender(params.sender || "")
      
      if (params.timestamp) {
        setTimestamp(formatTimestampFn(params.timestamp))
      } else {
        setTimestamp("")
      }
      
      setIsVisible(true)
    }
    
    // Register with the manager
    const unregister = mediaViewerManager.registerCallback(handleOpenMediaViewer)
    
    // Cleanup on unmount
    return unregister
  }, [formatTimestampFn])

  const handleClose = useCallback(() => {
    setIsVisible(false)
  }, [])

  return (
    <MediaViewer
      uri={uri}
      visible={isVisible}
      onClose={handleClose}
      sender={sender}
      timestamp={timestamp}
    />
  )
}

// Hook for components that want to trigger the media viewer
export function useMediaViewer(options?: IUseMediaViewerOptions) {
  const openMediaViewer = useCallback(
    (params: { uri: string; sender?: string; timestamp?: number }) => {
      console.log("openMediaViewer called with URI:", params.uri)
      mediaViewerManager.openMediaViewer(params)
    },
    []
  )

  return {
    openMediaViewer,
  }
} 